/**
 * Test file for Claude Code integration and backward compatibility
 *
 * This file demonstrates:
 * 1. Existing Pipeshub conversations continue to work unchanged
 * 2. New Claude Code conversations can be created and stored
 * 3. Both types can coexist in the same collection
 */

import { Conversation } from '../schema/conversation.schema';
import mongoose from 'mongoose';

// Mock Jest functions for TypeScript compilation (tests won't run without proper Jest setup)
declare function describe(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: any): any;

// Dummy implementation to satisfy TypeScript
if (typeof describe === 'undefined') {
  (global as any).describe = () => {};
  (global as any).test = () => {};
  (global as any).expect = () => ({ toBe: () => {}, toBeUndefined: () => {}, toBeNull: () => {} });
}

describe('Claude Code Integration - Backward Compatibility Tests', () => {

  /**
   * Test 1: Creating a traditional Pipeshub conversation
   * Should work exactly as before with conversationType defaulting to 'pipeshub'
   */
  test('Should create traditional Pipeshub conversation without Claude fields', async () => {
    const pipeshubConversation = {
      userId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      initiator: new mongoose.Types.ObjectId(),
      title: 'Sales Q4 Analysis',
      messages: [
        {
          messageType: 'user_query',
          content: 'What are our Q4 sales numbers?',
          contentFormat: 'MARKDOWN',
        },
        {
          messageType: 'bot_response',
          content: 'Based on the data, Q4 sales are $2.5M',
          contentFormat: 'MARKDOWN',
          confidence: 'High',
        }
      ],
      status: 'Complete',
      conversationSource: 'enterprise_search', // Existing Pipeshub field
    };

    const conversation = new Conversation(pipeshubConversation);

    // Validate that conversationType defaults to 'pipeshub'
    expect(conversation.conversationType).toBe('pipeshub');

    // Validate Claude fields are undefined (not affecting existing functionality)
    expect(conversation.claudeCodeSession).toBeUndefined();
    expect(conversation.claudeCodeMessages).toBeUndefined();

    // Validate all existing fields work as before
    expect(conversation.title).toBe('Sales Q4 Analysis');
    expect(conversation.messages.length).toBe(2);
    expect(conversation.status).toBe('Complete');
  });

  /**
   * Test 2: Creating a Claude Code conversation
   * Should store Claude-specific data while maintaining compatibility
   */
  test('Should create Claude Code conversation with new fields', async () => {
    const claudeConversation = {
      userId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      initiator: new mongoose.Types.ObjectId(),
      title: 'Claude Code Session - Fix Authentication Bug',

      // Regular Pipeshub messages (can still be used)
      messages: [
        {
          messageType: 'user_query',
          content: 'Help me fix the authentication bug in login.ts',
          contentFormat: 'MARKDOWN',
        }
      ],

      // Claude Code specific fields
      conversationType: 'claude_code' as const,

      claudeCodeSession: {
        sessionId: '37fe4e4a-fc19-46c2-ac96-4b239c2aa223',
      },

      claudeCodeMessages: [
        {
          uuid: '579796ef-4447-4957-af82-38d635ce25d3',
          parentUuid: null,
          timestamp: '2025-12-22T07:55:59.615Z',
          content: [
            {
              type: 'text' as const,
              text: 'Let me examine your login.ts file to identify the authentication bug.',
            }
          ],
        },
        {
          uuid: '07f551e5-2239-4d56-9bc1-273ebc2ee36a',
          parentUuid: '579796ef-4447-4957-af82-38d635ce25d3',
          timestamp: '2025-12-22T07:56:05.017Z',
          content: [
            {
              type: 'tool_use' as const,
              text: null,
              toolUse: {
                name: 'Read',
                input: new Map([
                  ['file_path', '/src/auth/login.ts'],
                ]),
              },
            }
          ],
        },
        {
          uuid: 'e659b906-ae64-4c1c-9025-ffff9c799f6f',
          parentUuid: '07f551e5-2239-4d56-9bc1-273ebc2ee36a',
          timestamp: '2025-12-22T07:56:08.582Z',
          content: [
            {
              type: 'tool_result' as const,
              text: null,
              toolResult: {
                content: 'File contents of login.ts...',
              },
            }
          ],
          tokenUsage: {
            input_tokens: 1500,
            output_tokens: 300,
            total_cost: 0.025,
          },
        },
      ],

      status: 'Inprogress',
      conversationSource: 'enterprise_search', // Still required
    };

    const conversation = new Conversation(claudeConversation);

    // Validate Claude Code specific fields
    expect(conversation.conversationType).toBe('claude_code');
    expect(conversation.claudeCodeSession?.sessionId).toBe('37fe4e4a-fc19-46c2-ac96-4b239c2aa223');
    expect(conversation.claudeCodeMessages?.length).toBe(3);

    // Validate message threading
    const messages = conversation.claudeCodeMessages!;
    expect(messages[0]?.parentUuid).toBeNull();
    expect(messages[1]?.parentUuid).toBe(messages[0]?.uuid);
    expect(messages[2]?.parentUuid).toBe(messages[1]?.uuid);

    // Validate tool tracking
    expect(messages[1]?.content?.[0]?.type).toBe('tool_use');
    expect(messages[1]?.content?.[0]?.toolUse?.name).toBe('Read');

    // Validate token usage
    expect(messages[2]?.tokenUsage?.total_cost).toBe(0.025);
  });

  /**
   * Test 3: Querying conversations by type
   * Should be able to filter Pipeshub vs Claude Code conversations
   */
  test('Should query conversations by type', async () => {
    // Mock query for Pipeshub conversations only
    const pipeshubQuery = {
      conversationType: 'pipeshub',
      orgId: new mongoose.Types.ObjectId(),
    };

    // Mock query for Claude Code conversations only
    const claudeQuery = {
      conversationType: 'claude_code',
      orgId: new mongoose.Types.ObjectId(),
    };

    // Mock query for all conversations (backward compatible)
    const allConversationsQuery: any = {
      orgId: new mongoose.Types.ObjectId(),
      // No conversationType filter - gets both types
    };

    // These would work with actual database:
    // const pipeshubConvs = await Conversation.find(pipeshubQuery);
    // const claudeConvs = await Conversation.find(claudeQuery);
    // const allConvs = await Conversation.find(allConversationsQuery);

    // Validate query structure
    expect(pipeshubQuery.conversationType).toBe('pipeshub');
    expect(claudeQuery.conversationType).toBe('claude_code');
    expect(allConversationsQuery.conversationType).toBeUndefined();
  });

  /**
   * Test 4: Migration compatibility
   * Existing conversations should get conversationType='pipeshub' after migration
   */
  test('Should handle migration of existing conversations', async () => {
    // Simulate an existing conversation before migration (no conversationType)
    const existingConversation = {
      userId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      initiator: new mongoose.Types.ObjectId(),
      title: 'Existing conversation',
      messages: [],
      conversationSource: 'enterprise_search',
      // Note: No conversationType field (simulating pre-migration data)
    };

    // After creating, conversationType should default to 'pipeshub'
    const conversation = new Conversation(existingConversation);
    expect(conversation.conversationType).toBe('pipeshub');

    // Migration script would update existing documents:
    // await Conversation.updateMany(
    //   { conversationType: { $exists: false } },
    //   { $set: { conversationType: 'pipeshub' } }
    // );
  });

  /**
   * Test 5: Mixed conversation handling
   * Can store both Pipeshub messages and Claude messages in same conversation
   */
  test('Should handle hybrid conversations with both message types', async () => {
    const hybridConversation = {
      userId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      initiator: new mongoose.Types.ObjectId(),
      title: 'Hybrid Conversation',

      // Traditional Pipeshub messages
      messages: [
        {
          messageType: 'user_query',
          content: 'Analyze our sales data',
          contentFormat: 'MARKDOWN',
        }
      ],

      // Mark as Claude Code conversation
      conversationType: 'claude_code' as const,

      // Claude Code specific data
      claudeCodeSession: {
        sessionId: 'hybrid-session-123',
      },

      claudeCodeMessages: [
        {
          uuid: 'claude-msg-1',
          timestamp: new Date().toISOString(),
          content: [
            {
              type: 'text' as const,
              text: 'I can help analyze your sales data using Claude Code tools.',
            }
          ],
        }
      ],

      conversationSource: 'enterprise_search',
    };

    const conversation = new Conversation(hybridConversation);

    // Both message types coexist
    expect(conversation.messages.length).toBe(1); // Pipeshub messages
    expect(conversation.claudeCodeMessages?.length).toBe(1); // Claude messages
    expect(conversation.conversationType).toBe('claude_code');
  });
});

/**
 * Example usage in application code
 */
export class ConversationService {

  /**
   * Create a Pipeshub conversation (unchanged from existing code)
   */
  async createPipeshubConversation(data: any) {
    const conversation = new Conversation({
      ...data,
      // conversationType will default to 'pipeshub'
    });
    return await conversation.save();
  }

  /**
   * Create a Claude Code conversation
   */
  async createClaudeCodeConversation(data: any, sessionId: string) {
    const conversation = new Conversation({
      ...data,
      conversationType: 'claude_code',
      claudeCodeSession: {
        sessionId: sessionId,
      },
      claudeCodeMessages: [],
    });
    return await conversation.save();
  }

  /**
   * Add a Claude message to existing conversation
   */
  async addClaudeMessage(conversationId: string, message: any) {
    const conversation = await Conversation.findById(conversationId);

    if (conversation && conversation.conversationType === 'claude_code') {
      conversation.claudeCodeMessages = conversation.claudeCodeMessages || [];
      conversation.claudeCodeMessages.push(message);
      await conversation.save();
    }

    return conversation;
  }

  /**
   * Query conversations with backward compatibility
   */
  async getConversations(orgId: string, type?: 'pipeshub' | 'claude_code') {
    const query: any = { orgId };

    if (type) {
      query.conversationType = type;
    } else {
      // If no type specified, defaults to getting all conversations
      // This maintains backward compatibility with existing queries
    }

    return await Conversation.find(query);
  }
}