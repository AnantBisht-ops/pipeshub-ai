/**
 * Response Compressor Service
 * Handles compression, decompression, and size management of API responses
 * Risk Mitigation: Large Responses - Prevents storage overflow and improves performance
 */

import { injectable } from 'inversify';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import { IResponseConfig } from '../types/cronScheduler.types';
import { STORAGE_PROVIDERS } from '../constants/cronScheduler.constants';

// Promisify compression functions for async/await
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

/**
 * Response compression result
 */
interface CompressionResult {
  data: any;              // The processed data (compressed or original)
  isCompressed: boolean;  // Whether the data was compressed
  isTruncated: boolean;   // Whether the data was truncated
  originalSize: number;   // Original size in bytes
  compressedSize: number; // Compressed size in bytes (same as original if not compressed)
  compressionRatio: number; // Compression ratio (0-1, lower is better compression)
  storageLocation?: string; // External storage location for large responses
  checksum?: string;      // MD5 checksum of the original data
}

/**
 * Storage reference for externally stored responses
 */
interface StorageReference {
  provider: string;       // Storage provider (s3, azure, local)
  location: string;       // Storage path/URL
  size: number;          // Size of stored data
  checksum: string;      // Checksum for verification
  expiresAt?: Date;      // When the stored data expires
}

@injectable()
export class ResponseCompressorService {
  private readonly compressionThreshold: number;
  private readonly compressionAlgorithm: string;
  private readonly compressionLevel: number;

  constructor() {
    const config = CronSchedulerConfig.responseHandling;
    this.compressionThreshold = config.compression.threshold;
    this.compressionAlgorithm = config.compression.algorithm;
    this.compressionLevel = config.compression.level;
  }

  /**
   * Compress response data if it exceeds threshold
   * Handles size limits and external storage for large responses
   */
  public async compressResponse(
    data: any,
    config: IResponseConfig
  ): Promise<CompressionResult> {
    // Convert data to string for processing
    const jsonString = this.safeStringify(data);
    const originalSize = Buffer.byteLength(jsonString, 'utf8');

    // Calculate checksum of original data
    const checksum = this.calculateChecksum(jsonString);

    console.log(`[ResponseCompressor] Original response size: ${this.formatSize(originalSize)}`);

    // Check if response exceeds max size
    if (originalSize > config.maxSizeBytes) {
      return await this.handleLargeResponse(jsonString, originalSize, config, checksum);
    }

    // Check if compression should be applied
    if (config.compressResponse && originalSize > this.compressionThreshold) {
      return await this.performCompression(jsonString, originalSize, checksum);
    }

    // Return uncompressed data
    return {
      data,
      isCompressed: false,
      isTruncated: false,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      checksum
    };
  }

  /**
   * Decompress response data if it was compressed
   */
  public async decompressResponse(
    data: any,
    isCompressed: boolean,
    algorithm: string = 'gzip'
  ): Promise<any> {
    if (!isCompressed) {
      // Data is not compressed, parse if it's a string
      return typeof data === 'string' && this.isJsonString(data) ?
        JSON.parse(data) : data;
    }

    try {
      // Convert base64 string to buffer
      const buffer = Buffer.from(data, 'base64');

      // Decompress based on algorithm
      let decompressed: Buffer;
      switch (algorithm) {
        case 'gzip':
          decompressed = await gunzip(buffer);
          break;
        case 'deflate':
          decompressed = await inflate(buffer);
          break;
        default:
          throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
      }

      // Parse the decompressed JSON
      const jsonString = decompressed.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error: any) {
      console.error('[ResponseCompressor] Decompression failed:', error);
      throw new Error(`Failed to decompress response: ${error.message}`);
    }
  }

  /**
   * Calculate the size of data in bytes
   */
  public calculateSize(data: any): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  /**
   * Check if compression should be applied based on size and config
   */
  public shouldCompress(size: number, config: IResponseConfig): boolean {
    return config.compressResponse &&
           size > this.compressionThreshold &&
           size <= config.maxSizeBytes;
  }

  /**
   * Truncate response data to fit within size limit
   */
  public truncateResponse(
    data: any,
    maxSize: number
  ): { data: any; isTruncated: boolean; originalSize: number } {
    const jsonString = this.safeStringify(data);
    const originalSize = Buffer.byteLength(jsonString, 'utf8');

    if (originalSize <= maxSize) {
      return {
        data,
        isTruncated: false,
        originalSize
      };
    }

    console.log(`[ResponseCompressor] Truncating response from ${this.formatSize(originalSize)} to ${this.formatSize(maxSize)}`);

    // Try to truncate intelligently
    if (typeof data === 'object' && data !== null) {
      return this.intelligentTruncate(data, maxSize, originalSize);
    }

    // Simple string truncation
    const truncated = jsonString.substring(0, maxSize - 100); // Leave room for truncation message
    const truncatedData = {
      data: truncated,
      _truncated: true,
      _originalSize: originalSize,
      _message: 'Response truncated due to size limit'
    };

    return {
      data: truncatedData,
      isTruncated: true,
      originalSize
    };
  }

  /**
   * Generate storage reference for external storage
   */
  public generateStorageReference(
    provider: string,
    size: number,
    checksum: string
  ): StorageReference {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(16).toString('hex');

    let location: string;
    const storageConfig = CronSchedulerConfig.responseHandling.storage;

    switch (provider) {
      case STORAGE_PROVIDERS.S3:
        location = `s3://${storageConfig.s3.bucket}/${storageConfig.s3.prefix}${timestamp}/${randomId}.json.gz`;
        break;
      case STORAGE_PROVIDERS.AZURE:
        location = `azure://${storageConfig.azure.containerName}/${storageConfig.azure.prefix}${timestamp}/${randomId}.json.gz`;
        break;
      case STORAGE_PROVIDERS.LOCAL:
        location = `local://${storageConfig.localPath}/${timestamp}/${randomId}.json.gz`;
        break;
      default:
        location = `${provider}://${timestamp}/${randomId}.json.gz`;
    }

    return {
      provider,
      location,
      size,
      checksum,
      expiresAt: new Date(Date.now() + storageConfig.ttl * 1000)
    };
  }

  /**
   * Store response to external storage (placeholder - implement based on provider)
   */
  public async storeExternally(
    data: any,
    provider: string = STORAGE_PROVIDERS.LOCAL
  ): Promise<StorageReference> {
    const jsonString = this.safeStringify(data);
    const size = Buffer.byteLength(jsonString, 'utf8');
    const checksum = this.calculateChecksum(jsonString);

    // Compress before storing
    const compressed = await gzip(jsonString, { level: this.compressionLevel });
    const compressedSize = compressed.length;

    console.log(`[ResponseCompressor] Storing externally: ${this.formatSize(size)} → ${this.formatSize(compressedSize)} (${provider})`);

    // Generate storage reference
    const reference = this.generateStorageReference(provider, compressedSize, checksum);

    // TODO: Implement actual storage based on provider
    // For now, just return the reference
    // In production, this would upload to S3, Azure, or local filesystem

    switch (provider) {
      case STORAGE_PROVIDERS.S3:
        // await this.uploadToS3(compressed, reference.location);
        break;
      case STORAGE_PROVIDERS.AZURE:
        // await this.uploadToAzure(compressed, reference.location);
        break;
      case STORAGE_PROVIDERS.LOCAL:
        // await this.saveToLocalFile(compressed, reference.location);
        break;
    }

    return reference;
  }

  /**
   * Retrieve response from external storage (placeholder)
   */
  public async retrieveExternally(reference: StorageReference): Promise<any> {
    console.log(`[ResponseCompressor] Retrieving from external storage: ${reference.location}`);

    // TODO: Implement actual retrieval based on provider
    // For now, throw not implemented error
    throw new Error(`External storage retrieval not yet implemented for provider: ${reference.provider}`);
  }

  /**
   * Get compression statistics
   */
  public getCompressionStats(original: number, compressed: number): {
    originalSize: string;
    compressedSize: string;
    savedBytes: number;
    savedPercentage: number;
    compressionRatio: number;
  } {
    const saved = original - compressed;
    const savedPercentage = (saved / original) * 100;
    const ratio = compressed / original;

    return {
      originalSize: this.formatSize(original),
      compressedSize: this.formatSize(compressed),
      savedBytes: saved,
      savedPercentage: Math.round(savedPercentage * 100) / 100,
      compressionRatio: Math.round(ratio * 1000) / 1000
    };
  }

  /**
   * Perform actual compression
   */
  private async performCompression(
    jsonString: string,
    originalSize: number,
    checksum: string
  ): Promise<CompressionResult> {
    try {
      let compressed: Buffer;

      // Choose compression algorithm
      switch (this.compressionAlgorithm) {
        case 'gzip':
          compressed = await gzip(jsonString, { level: this.compressionLevel });
          break;
        case 'deflate':
          compressed = await deflate(jsonString, { level: this.compressionLevel });
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${this.compressionAlgorithm}`);
      }

      const compressedSize = compressed.length;
      const compressionRatio = compressedSize / originalSize;

      // Only use compression if it actually reduces size significantly (>10% reduction)
      if (compressionRatio > 0.9) {
        console.log('[ResponseCompressor] Compression not effective, returning original');
        return {
          data: JSON.parse(jsonString),
          isCompressed: false,
          isTruncated: false,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          checksum
        };
      }

      const stats = this.getCompressionStats(originalSize, compressedSize);
      console.log(`[ResponseCompressor] Compressed: ${stats.originalSize} → ${stats.compressedSize} (${stats.savedPercentage}% saved)`);

      // Return compressed data as base64 string
      return {
        data: compressed.toString('base64'),
        isCompressed: true,
        isTruncated: false,
        originalSize,
        compressedSize,
        compressionRatio,
        checksum
      };
    } catch (error: any) {
      console.error('[ResponseCompressor] Compression failed:', error);
      // Fall back to uncompressed data
      return {
        data: JSON.parse(jsonString),
        isCompressed: false,
        isTruncated: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        checksum
      };
    }
  }

  /**
   * Handle large responses that exceed size limits
   */
  private async handleLargeResponse(
    jsonString: string,
    originalSize: number,
    config: IResponseConfig,
    checksum: string
  ): Promise<CompressionResult> {
    console.log(`[ResponseCompressor] Response exceeds limit: ${this.formatSize(originalSize)} > ${this.formatSize(config.maxSizeBytes)}`);

    if (config.storeFullResponse) {
      // Store to external storage
      try {
        const storageRef = await this.storeExternally(
          JSON.parse(jsonString),
          CronSchedulerConfig.responseHandling.storage.provider
        );

        return {
          data: {
            _type: 'external_storage',
            _message: 'Response stored externally due to size',
            _storage: storageRef,
            _originalSize: originalSize
          },
          isCompressed: false,
          isTruncated: false,
          originalSize,
          compressedSize: 0,
          compressionRatio: 0,
          storageLocation: storageRef.location,
          checksum
        };
      } catch (error) {
        console.error('[ResponseCompressor] External storage failed:', error);
        // Fall back to truncation
      }
    }

    // Truncate the response
    const truncated = this.truncateResponse(JSON.parse(jsonString), config.maxSizeBytes);

    return {
      data: truncated.data,
      isCompressed: false,
      isTruncated: truncated.isTruncated,
      originalSize,
      compressedSize: this.calculateSize(truncated.data),
      compressionRatio: 1,
      checksum
    };
  }

  /**
   * Intelligently truncate object data
   */
  private intelligentTruncate(
    data: any,
    maxSize: number,
    originalSize: number
  ): { data: any; isTruncated: boolean; originalSize: number } {
    // Try to preserve structure while reducing size
    const truncated: any = {
      _truncated: true,
      _originalSize: originalSize,
      _message: 'Response truncated due to size limit'
    };

    // If it's an array, keep first few items
    if (Array.isArray(data)) {
      let items = [];
      let currentSize = 100; // Base object size

      for (const item of data) {
        const itemSize = this.calculateSize(item);
        if (currentSize + itemSize > maxSize - 200) break;
        items.push(item);
        currentSize += itemSize;
      }

      truncated.data = items;
      truncated._originalCount = data.length;
      truncated._truncatedCount = items.length;
    } else {
      // For objects, keep most important fields
      const fields = Object.keys(data);
      let currentSize = 100;
      truncated.data = {};

      for (const field of fields) {
        const fieldSize = this.calculateSize({ [field]: data[field] });
        if (currentSize + fieldSize > maxSize - 200) break;
        truncated.data[field] = data[field];
        currentSize += fieldSize;
      }

      truncated._originalFields = fields.length;
      truncated._truncatedFields = Object.keys(truncated.data).length;
    }

    return {
      data: truncated,
      isTruncated: true,
      originalSize
    };
  }

  /**
   * Calculate MD5 checksum of data
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Safely stringify data with circular reference handling
   */
  private safeStringify(data: any): string {
    const seen = new WeakSet();
    return JSON.stringify(data, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  /**
   * Check if a string is valid JSON
   */
  private isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format size in human-readable format
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}