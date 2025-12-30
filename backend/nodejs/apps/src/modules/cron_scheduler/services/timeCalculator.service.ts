/**
 * Time Calculator Service
 * Handles all time-related calculations and conversions for the cron scheduler
 * CRITICAL: All times are stored in UTC to prevent timezone issues
 */

import moment from 'moment-timezone';
const parser = require('cron-parser');
import { injectable } from 'inversify';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import {
  ICronJobRequest,
  ICronJob
} from '../types/cronScheduler.types';

/**
 * Interface for recurring schedule parsing
 */
interface IRecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

@injectable()
export class TimeCalculatorService {

  /**
   * Parse schedule from request and convert to UTC
   * Risk Mitigation: Timezone Issues - All times converted to UTC
   */
  public parseScheduleToUTC(
    schedule: ICronJobRequest,
    userTimezone: string = 'UTC'
  ): Date {
    // Validate timezone
    if (!this.isValidTimezone(userTimezone)) {
      throw new Error(`Invalid timezone: ${userTimezone}`);
    }

    if (schedule.scheduleType === 'once' && schedule.oneTime) {
      return this.parseOneTimeSchedule(schedule.oneTime, userTimezone);
    }

    if (schedule.scheduleType === 'recurring' && schedule.recurring) {
      return this.calculateNextRun(schedule.recurring, userTimezone);
    }

    throw new Error('Invalid schedule configuration');
  }

  /**
   * Parse one-time schedule to UTC Date
   */
  private parseOneTimeSchedule(
    oneTime: { date: string; time: string },
    userTimezone: string
  ): Date {
    // Parse user's local time
    const localDateTime = moment.tz(
      `${oneTime.date} ${oneTime.time}`,
      'YYYY-MM-DD HH:mm',
      userTimezone
    );

    // Validate date format
    if (!localDateTime.isValid()) {
      throw new Error('Invalid date/time format. Expected: YYYY-MM-DD HH:MM');
    }

    // Validate future date
    if (localDateTime.isSameOrBefore(moment())) {
      throw new Error('Schedule time must be in the future');
    }

    // Convert to UTC and return as Date object
    return localDateTime.utc().toDate();
  }

  /**
   * Generate cron expression for BullMQ (in UTC)
   */
  public generateCronExpression(
    recurring: IRecurringSchedule,
    userTimezone: string
  ): string {
    // Validate timezone
    if (!this.isValidTimezone(userTimezone)) {
      throw new Error(`Invalid timezone: ${userTimezone}`);
    }

    // Parse time and convert to UTC
    const userTime = moment.tz(
      `2000-01-01 ${recurring.time}`,
      'YYYY-MM-DD HH:mm',
      userTimezone
    ).utc();

    if (!userTime.isValid()) {
      throw new Error('Invalid time format. Expected: HH:MM');
    }

    const hour = userTime.hour();
    const minute = userTime.minute();

    let cronExpression: string;

    switch (recurring.frequency) {
      case 'daily':
        // Every day at specified time (UTC)
        cronExpression = `${minute} ${hour} * * *`;
        break;

      case 'weekly':
        // Validate days of week
        if (!recurring.daysOfWeek || recurring.daysOfWeek.length === 0) {
          throw new Error('Weekly schedule requires at least one day of week');
        }

        // Validate each day is 0-6
        const invalidDays = recurring.daysOfWeek.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          throw new Error('Days of week must be between 0 (Sunday) and 6 (Saturday)');
        }

        const days = recurring.daysOfWeek.sort().join(',');
        cronExpression = `${minute} ${hour} * * ${days}`;
        break;

      case 'monthly':
        // Validate day of month
        const dayOfMonth = recurring.dayOfMonth || 1;
        if (dayOfMonth < 1 || dayOfMonth > 31) {
          throw new Error('Day of month must be between 1 and 31');
        }

        cronExpression = `${minute} ${hour} ${dayOfMonth} * *`;
        break;

      default:
        throw new Error(`Unsupported frequency: ${recurring.frequency}`);
    }

    // Validate the cron expression
    try {
      parser.parseExpression(cronExpression);
    } catch (error) {
      throw new Error(`Invalid cron expression generated: ${cronExpression}`);
    }

    return cronExpression;
  }

  /**
   * Calculate next run time for recurring schedule (always returns UTC)
   */
  public calculateNextRun(
    recurring: IRecurringSchedule,
    userTimezone: string,
    fromDate: Date = new Date()
  ): Date {
    const cronExpression = this.generateCronExpression(recurring, userTimezone);

    // Parse start date if provided
    const startDate = recurring.startDate ?
      moment.tz(recurring.startDate, 'YYYY-MM-DD', userTimezone).utc().toDate() :
      fromDate;

    // Use the later of fromDate or startDate
    const currentDate = startDate > fromDate ? startDate : fromDate;

    try {
      // Use cron-parser to calculate next run
      const interval = parser.parseExpression(cronExpression, {
        currentDate,
        tz: 'UTC' // Always work in UTC
      });

      const nextDate = interval.next().toDate();

      // Check if end date is specified and if we've exceeded it
      if (recurring.endDate) {
        const endDate = moment.tz(
          `${recurring.endDate} 23:59:59`,
          'YYYY-MM-DD HH:mm:ss',
          userTimezone
        ).utc().toDate();

        if (nextDate > endDate) {
          throw new Error('Next run date exceeds the specified end date');
        }
      }

      return nextDate;
    } catch (error: any) {
      if (error.message.includes('end date')) {
        throw error;
      }
      throw new Error(`Failed to calculate next run time: ${error.message}`);
    }
  }

  /**
   * Calculate next N run times for preview
   */
  public calculateNextNRuns(
    recurring: IRecurringSchedule,
    userTimezone: string,
    count: number = 5,
    fromDate: Date = new Date()
  ): Date[] {
    const runs: Date[] = [];
    const cronExpression = this.generateCronExpression(recurring, userTimezone);

    // Parse start date if provided
    const startDate = recurring.startDate ?
      moment.tz(recurring.startDate, 'YYYY-MM-DD', userTimezone).utc().toDate() :
      fromDate;

    // Parse end date if provided
    const endDate = recurring.endDate ?
      moment.tz(
        `${recurring.endDate} 23:59:59`,
        'YYYY-MM-DD HH:mm:ss',
        userTimezone
      ).utc().toDate() :
      undefined;

    // Use the later of fromDate or startDate
    const currentDate = startDate > fromDate ? startDate : fromDate;

    try {
      const interval = parser.parseExpression(cronExpression, {
        currentDate,
        tz: 'UTC',
        endDate
      });

      for (let i = 0; i < count; i++) {
        try {
          const next = interval.next();
          if (next && !next.done) {
            runs.push(next.toDate());
          } else {
            break; // No more runs available
          }
        } catch {
          break; // Reached end date or no more occurrences
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to calculate run times: ${error.message}`);
    }

    return runs;
  }

  /**
   * Validate if a timezone is supported
   */
  public isValidTimezone(timezone: string): boolean {
    // Check if timezone exists in moment-timezone
    if (!moment.tz.zone(timezone)) {
      return false;
    }

    // Check if it's in our supported list (optional restriction)
    if (CronSchedulerConfig.timezone.supported.length > 0) {
      return CronSchedulerConfig.timezone.supported.includes(timezone);
    }

    return true;
  }

  /**
   * Convert UTC date to user's timezone for display
   */
  public convertFromUTC(date: Date, userTimezone: string): string {
    if (!this.isValidTimezone(userTimezone)) {
      throw new Error(`Invalid timezone: ${userTimezone}`);
    }

    return moment(date)
      .tz(userTimezone)
      .format('YYYY-MM-DD HH:mm:ss z');
  }

  /**
   * Get timezone offset in minutes
   */
  public getTimezoneOffset(timezone: string): number {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    return moment.tz.zone(timezone)?.utcOffset(Date.now()) || 0;
  }

  /**
   * Validate that a date is in the future
   */
  public validateFutureDate(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Parse a cron expression and get human-readable description
   */
  public describeCronExpression(cronExpression: string): string {
    try {
      const interval = parser.parseExpression(cronExpression);
      const fields = interval.fields;

      // Build human-readable description
      const parts: string[] = [];

      // Time
      const minute = fields.minute[0];
      const hour = fields.hour[0];
      parts.push(`at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);

      // Frequency
      if (fields.dayOfWeek.length === 7 && fields.dayOfMonth.length === 31) {
        parts.push('every day');
      } else if (fields.dayOfWeek.length < 7) {
        const days = fields.dayOfWeek.map((d: number) => {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return dayNames[d];
        });
        parts.push(`on ${days.join(', ')}`);
      } else if (fields.dayOfMonth.length < 31) {
        const dates = fields.dayOfMonth.join(', ');
        parts.push(`on day ${dates} of the month`);
      }

      return parts.join(' ');
    } catch {
      return 'Custom schedule';
    }
  }

  /**
   * Check if a schedule should be active based on current time
   */
  public isScheduleActive(job: ICronJob): boolean {
    const now = new Date();

    // Check if job has started
    if (job.scheduleType === 'recurring' && job.recurring) {
      if (job.recurring.startDate > now) {
        return false;
      }

      // Check if job has ended
      if (job.recurring.endDate && job.recurring.endDate < now) {
        return false;
      }
    }

    // Check status
    return job.status === 'active';
  }

  /**
   * Calculate delay in milliseconds until next run
   */
  public calculateDelayUntilNextRun(nextRunAt: Date): number {
    const delay = nextRunAt.getTime() - Date.now();
    return delay > 0 ? delay : 0;
  }

  /**
   * Format duration in human-readable format
   */
  public formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Get all supported timezones
   */
  public getSupportedTimezones(): string[] {
    return CronSchedulerConfig.timezone.supported.length > 0 ?
      CronSchedulerConfig.timezone.supported :
      moment.tz.names();
  }

  /**
   * Validate schedule consistency
   */
  public validateSchedule(schedule: ICronJobRequest): void {
    if (schedule.scheduleType === 'once') {
      if (!schedule.oneTime || !schedule.oneTime.date || !schedule.oneTime.time) {
        throw new Error('One-time schedule requires date and time');
      }
    } else if (schedule.scheduleType === 'recurring') {
      if (!schedule.recurring) {
        throw new Error('Recurring schedule configuration is required');
      }

      const { frequency, time, startDate } = schedule.recurring;

      if (!frequency || !time || !startDate) {
        throw new Error('Recurring schedule requires frequency, time, and start date');
      }

      if (frequency === 'weekly' && (!schedule.recurring.daysOfWeek || schedule.recurring.daysOfWeek.length === 0)) {
        throw new Error('Weekly schedule requires at least one day of week');
      }

      if (schedule.recurring.endDate && schedule.recurring.endDate <= startDate) {
        throw new Error('End date must be after start date');
      }
    } else {
      throw new Error('Invalid schedule type');
    }
  }
}