# AI Nurture Project

## Project Overview
AI Nurture is a comprehensive platform designed to manage campaigns, schedules, enrollments, and events. It provides robust backend functionality and a user-friendly frontend interface for seamless operations.

## Features

### Backend Features
1. **Direct Schedules**
   - Pause and resume functionality for direct schedules.
   - Support for custom repeat schedules (e.g., daily, specific days).
   - API endpoints for pausing and resuming schedules.

2. **Group Schedules**
   - Pause and resume functionality for group schedules.
   - Backend validation for user permissions.

3. **Enrollments**
   - Bulk pause, stop, and resume enrollments for sequences.
   - API endpoints for managing sequence enrollments.

4. **Campaign Management**
   - Pause and resume campaigns.
   - Campaign statistics and status updates.

5. **Event Management**
   - CRUD operations for events and reminders.
   - File upload support for images and videos.

6. **Session Management**
   - Custom session store using a single file for persistence.

7. **Cron Jobs**
   - Automated checks for due schedules and message execution.

### Frontend Features
1. **UI Enhancements**
   - Dark theme with vibrant gradients and hover effects.
   - Responsive design for mobile and desktop.

2. **Direct Schedule Management**
   - Pause and resume buttons with visual indicators.
   - Real-time updates for schedule status.

3. **Group Schedule Management**
   - Similar UI and functionality as direct schedules.

4. **Enrollments Management**
   - Bulk actions for pausing, stopping, and resuming enrollments.
   - Visual feedback for enrollment statuses.

5. **Campaign Management**
   - Pause and resume campaigns with confirmation modals.
   - Campaign statistics displayed in the dashboard.

6. **Event Management**
   - File upload previews for images and videos.
   - Reminder configuration for events.

7. **Cache Busting**
   - Automatic cache-busting for frontend assets.

8. **Notification System**
   - Toast notifications for user actions and errors.

## Architecture
The project follows a modular architecture with a clear separation of concerns between the backend and frontend. The backend handles API requests, data processing, and business logic, while the frontend provides an interactive user interface.

## Technologies Used
- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript, Tailwind CSS
- **Database**: JSON-based file storage (for simplicity)
- **Others**: Nodemon, Cron Jobs

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/saemahesh/ai-nurture.git
   ```
2. Navigate to the project directory:
   ```bash
   cd ai-nurture
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Access the application at `http://localhost:3000`.

## API Documentation

### Key Endpoints and Logic

#### Direct Schedules
- **GET /api/direct-schedules**: Fetch all direct schedules for the authenticated user. Includes data migration for older schedules.
- **PUT /api/direct-schedules/:id/pause**: Pause a specific direct schedule. Updates the `paused` field to `true`.
- **PUT /api/direct-schedules/:id/resume**: Resume a specific direct schedule. Updates the `paused` field to `false`.

#### Group Schedules
- **GET /api/group-schedules**: Fetch all group schedules for the authenticated user.
- **POST /api/group-schedules**: Create a new group schedule with validation for user permissions.

#### Enrollments
- **GET /api/enrollments**: Fetch all enrollments for the authenticated user. Supports filtering by sequence ID.
- **POST /api/enrollments/:sequenceId/enroll**: Enroll a single user in a sequence. Validates phone number and sequence status.
- **POST /api/enrollments/:sequenceId/enroll/bulk**: Bulk enroll users using a list of phone numbers.
- **POST /api/enrollments/:sequenceId/enroll/csv**: Bulk enroll users by uploading a CSV file.
- **PUT /api/enrollments/:enrollmentId**: Update the status of an enrollment (e.g., active, paused, stopped).
- **DELETE /api/enrollments/:enrollmentId**: Delete a specific enrollment and remove associated messages from the queue.

#### Campaign Management
- **GET /api/campaigns**: Fetch all campaigns for the authenticated user.
- **POST /api/campaigns**: Create a new campaign with validation for required fields.
- **POST /api/campaigns/:id/resume**: Resume a paused campaign. Updates the status to `active`.
- **GET /api/campaigns/:id**: Fetch details of a specific campaign.

#### Event Management
- **GET /api/events**: Fetch all events for the authenticated user.
- **POST /api/events**: Create a new event with support for file uploads (images/videos).
- **PUT /api/events/:id**: Update an existing event.
- **DELETE /api/events/:id**: Delete a specific event.

#### Sequences
- **GET /api/sequences**: Fetch all sequences for the authenticated user.
- **POST /api/sequences**: Create a new sequence with validation for messages.
- **PUT /api/sequences/:id**: Update an existing sequence, including its messages and status.

#### Analytics
- **GET /api/analytics/campaign/:campaignId**: Fetch analytics for a specific campaign, including enrollments and messages sent.
- **GET /api/analytics/dashboard**: Fetch dashboard analytics for the authenticated user, including recent activity and top-performing campaigns.

#### Schedules
- **GET /api/schedule**: Fetch all schedules for the authenticated user. Includes data migration for older schedules.
- **POST /api/schedule**: Create a new schedule with support for file uploads and repeat configurations.

#### Status
- **GET /api/status**: Fetch the current status of the system, including active campaigns and pending messages.

#### Webhooks
- **POST /api/webhook**: Handle incoming webhook events for external integrations.

## Logic Details

### Data Migration
- Older schedules and enrollments are automatically migrated to include new fields (e.g., `paused`, `repeat`).

### Message Scheduling
- Messages are scheduled based on sequence configurations, with support for randomization and personalization.

### File Uploads
- Events and schedules support file uploads (images/videos) with validation for file types and size limits.

### Error Handling
- All endpoints include robust error handling with detailed error messages for invalid requests.

## Cron Jobs
- **Schedule Checker**: Periodically checks for due schedules and triggers actions.
- **Message Executor**: Processes and sends queued messages.

## File Structure
```
backend/
  app.js
  routes/
  middleware/
  data/
frontend/
  public/
  controllers/
  services/
```

## Contributing
1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Commit your changes with clear messages.
4. Submit a pull request for review.