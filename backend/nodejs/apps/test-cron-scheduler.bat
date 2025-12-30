@echo off
echo ========================================
echo   CRON SCHEDULER API ENDPOINT TESTER
echo   WITH DEEPAK'S OPENANALYST INTEGRATION
echo ========================================
echo.

REM Base configuration for YOUR scheduler
set SCHEDULER_URL=http://localhost:3000/api/v1/cron
set CONTENT_TYPE=Content-Type: application/json

REM Deepak's OpenAnalyst API configuration
set OPENANALYST_BASE=https://api.openanalyst.com:3456
set OPENANALYST_AUTH=%OPENANALYST_BASE%/api/auth/token
set OPENANALYST_AGENT=%OPENANALYST_BASE%/api/agent/run

REM Test data - Replace with real values in production
set TEST_ORG_ID=675f3a2b4e8c9d001f2b3c4d
set TEST_USER_ID=675f3a2b4e8c9d005e6f7a8b
set TEST_PROJECT_ID=675f3a2b4e8c9d009c1d2e3f

REM Deepak's API credentials - REPLACE WITH REAL VALUES
set API_KEY=master-key-1
set USER_ID=user-123

REM Get tomorrow's date for scheduling tests
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set year=%datetime:~0,4%
set month=%datetime:~4,2%
set day=%datetime:~6,2%
set /a day+=1
set TOMORROW=%year%-%month%-%day%

echo [TEST ENVIRONMENT]
echo ========================================
echo YOUR Scheduler: %SCHEDULER_URL%
echo DEEPAK's API: %OPENANALYST_BASE%
echo Target Endpoint: %OPENANALYST_AGENT%
echo Test Date: %date% %time%
echo Schedule Date: %TOMORROW%
echo ========================================
echo.

echo [STEP 1] GET BEARER TOKEN FROM DEEPAK'S API
echo ---------------------------------------------
echo Getting authentication token...
curl -X POST "%OPENANALYST_AUTH%" ^
  -H "%CONTENT_TYPE%" ^
  -d "{\"userId\": \"%USER_ID%\", \"apiKey\": \"%API_KEY%\"}"
echo.
echo.
echo IMPORTANT: Copy the token from above response!
echo You'll need it for the Authorization header.
echo ========================================
echo.

timeout /t 3 /nobreak > nul

echo [STEP 2] HEALTH CHECK YOUR SCHEDULER
echo -------------------------------------
curl -X GET "%SCHEDULER_URL%/health" ^
  -H "%CONTENT_TYPE%"
echo.
echo.

timeout /t 2 /nobreak > nul

echo [STEP 3] CREATE SCHEDULED JOB - One-time (9 AM tomorrow)
echo ---------------------------------------------------------
echo This job will run tomorrow at 9:00 AM and call Deepak's agent
echo.
echo REPLACE_TOKEN_HERE with actual Bearer token from Step 1:
echo.
curl -X POST "%SCHEDULER_URL%/schedule" ^
  -H "%CONTENT_TYPE%" ^
  -d "{\"name\": \"Daily Report for Aayush\", \"prompt\": \"Generate daily summary report for the project\", \"targetApi\": \"%OPENANALYST_AGENT%\", \"scheduleType\": \"once\", \"timezone\": \"Asia/Kolkata\", \"oneTime\": {\"date\": \"%TOMORROW%\", \"time\": \"09:00\"}, \"orgId\": \"%TEST_ORG_ID%\", \"userId\": \"%TEST_USER_ID%\", \"projectId\": \"%TEST_PROJECT_ID%\", \"skillId\": \"daily-report-generator\", \"metadata\": {\"conversationId\": \"conv_aayush_123\", \"sessionId\": \"sess_chat_456\", \"chatboxId\": \"chatbox_789\", \"userEmail\": \"aayush@example.com\", \"userName\": \"Aayush\", \"projectName\": \"OpenAnalyst\", \"model\": \"claude-3-5-sonnet-20241022\"}, \"headers\": {\"Authorization\": \"Bearer REPLACE_TOKEN_HERE\", \"Content-Type\": \"application/json\", \"Accept\": \"text/event-stream\"}}"
echo.
echo.

timeout /t 2 /nobreak > nul

echo [STEP 4] CREATE RECURRING DAILY JOB (Every day at 10 AM)
echo ---------------------------------------------------------
echo This job will run daily and send results to Aayush's chatbox
echo.
curl -X POST "%SCHEDULER_URL%/schedule" ^
  -H "%CONTENT_TYPE%" ^
  -d "{\"name\": \"Daily Standup Reminder\", \"prompt\": \"Generate standup meeting agenda and send reminder\", \"targetApi\": \"%OPENANALYST_AGENT%\", \"scheduleType\": \"recurring\", \"timezone\": \"Asia/Kolkata\", \"recurring\": {\"frequency\": \"daily\", \"time\": \"10:00\", \"startDate\": \"%TOMORROW%\"}, \"orgId\": \"%TEST_ORG_ID%\", \"userId\": \"%TEST_USER_ID%\", \"skillId\": \"standup-reminder\", \"metadata\": {\"conversationId\": \"conv_standup_daily\", \"sessionId\": \"sess_standup\", \"chatboxId\": \"chatbox_main\", \"userEmail\": \"team@example.com\", \"projectName\": \"OpenAnalyst\", \"model\": \"claude-3-5-sonnet-20241022\"}, \"headers\": {\"Authorization\": \"Bearer REPLACE_TOKEN_HERE\", \"Content-Type\": \"application/json\"}}"
echo.
echo.

timeout /t 2 /nobreak > nul

echo [STEP 5] CREATE WEEKLY REPORT JOB (Every Monday at 9 AM)
echo ---------------------------------------------------------
curl -X POST "%SCHEDULER_URL%/schedule" ^
  -H "%CONTENT_TYPE%" ^
  -d "{\"name\": \"Weekly Progress Report\", \"prompt\": \"Generate comprehensive weekly progress report with metrics\", \"targetApi\": \"%OPENANALYST_AGENT%\", \"scheduleType\": \"recurring\", \"timezone\": \"Asia/Kolkata\", \"recurring\": {\"frequency\": \"weekly\", \"time\": \"09:00\", \"startDate\": \"%TOMORROW%\", \"daysOfWeek\": [1]}, \"orgId\": \"%TEST_ORG_ID%\", \"userId\": \"%TEST_USER_ID%\", \"metadata\": {\"conversationId\": \"conv_weekly_reports\", \"sessionId\": \"sess_reports\", \"chatboxId\": \"chatbox_reports\", \"userName\": \"Manager\", \"model\": \"claude-3-5-sonnet-20241022\"}, \"headers\": {\"Authorization\": \"Bearer REPLACE_TOKEN_HERE\", \"Content-Type\": \"application/json\"}}"
echo.
echo.

timeout /t 2 /nobreak > nul

echo [STEP 6] LIST ALL SCHEDULED JOBS
echo ---------------------------------
curl -X GET "%SCHEDULER_URL%/jobs?orgId=%TEST_ORG_ID%" ^
  -H "%CONTENT_TYPE%"
echo.
echo.

echo ========================================
echo   PRODUCTION INTEGRATION CHECKLIST
echo ========================================
echo.
echo 1. AUTHENTICATION SETUP:
echo    - Get API key from Deepak: "master-key-1"
echo    - Use your actual userId instead of "user-123"
echo    - Get Bearer token: POST %OPENANALYST_AUTH%
echo    - Token is valid for 7 days
echo.
echo 2. WHEN CREATING JOBS:
echo    - targetApi: %OPENANALYST_AGENT%
echo    - Include Bearer token in headers
echo    - Add all metadata (conversationId, sessionId, etc)
echo    - Specify model: "claude-3-5-sonnet-20241022"
echo.
echo 3. WHAT HAPPENS AT EXECUTION:
echo    - Your scheduler calls Deepak's agent API
echo    - Includes context with conversationId
echo    - Deepak processes and sends to Aayush's chatbox
echo    - Response goes directly to user's chat
echo.
echo 4. CRITICAL FIELDS:
echo    - conversationId: Which chat to respond to
echo    - sessionId: Active session identifier
echo    - chatboxId: UI component to update
echo    - model: Claude model to use
echo.
echo 5. TEST WITH REAL VALUES:
echo    - Replace TEST_ORG_ID with real orgId
echo    - Replace TEST_USER_ID with real userId
echo    - Get real conversationId from Harsh
echo    - Use actual Bearer token from Step 1
echo.
pause