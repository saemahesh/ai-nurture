# AutoPost WhatsApp

A full-stack web application for managing and automating WhatsApp group posts, with a focus on event-based reminders, scheduling, and media uploads. It features user authentication and per-user data isolation.

## Features

### User Authentication
- **Register**: Create a new user account with a username and password.
- **Login/Logout**: Secure session-based authentication.
- **Session Management**: Only logged-in users can access the application's core features.

### Group Management
- **Create Group**: Add new WhatsApp groups with a name and a list of members.
- **List Groups**: View all groups created by the logged-in user.
- **Delete Group**: Remove a group.
- **Per-User Data**: Each user only sees and manages their own groups, ensuring privacy.

### Event Management
- **Create Event**: Define events with a name, description, and a specific date/time.
- **Edit Event**: Modify event details and timing.
- **List Events**: View all events created by the logged-in user.
- **Delete Event**: Remove an event.
- **Automatic Reminders**: The system automatically generates and sends multiple reminder messages to selected WhatsApp groups leading up to an event.

### Advanced Event Reminder System
- **Countdown Reminders**: Automatically sends reminder messages at pre-defined intervals before an event (e.g., 5 days, 4 days, ..., 1 hour, 30 minutes, and at the event start time).
- **Fully Customizable Content**: Each reminder can have unique text and media.
- **Enable/Disable Options**: Easily turn specific reminders on or off as needed.
- **Custom Media Per Reminder**: Attach a different image or video to each reminder message from the user's media library.
- **Template Variables**: Use `{{eventName}}` in reminder messages to dynamically insert the event's name.

### Schedule Management
- **Automatic Schedule Generation**: When event reminders are configured, the system automatically populates the master schedule.
- **List Schedules**: View all upcoming and sent messages, including their status (Scheduled, Sent, Failed).
- **Manual Scheduling**: Create one-off scheduled messages for any group at a specific time.
- **Delete Schedule**: Remove a scheduled post.
- **Edit Schedule**: Modify scheduled messages before they are sent.
- **Per-User Data**: Each user only sees and manages their own schedules.

### Direct Message Scheduling
- **Schedule Message Schedule**: Send messages directly to individual phone numbers at specific times.
- **Text and Media Support**: Schedule both text-only messages and messages with media attachments.
- **Media Library Integration**: Select media files from your personal library or provide external URLs.
- **Full URL Generation**: Media URLs are automatically converted to full URLs for WhatsApp API compatibility.
- **Status Tracking**: Monitor the status of scheduled Message Schedule (Scheduled, Sent, Failed).
- **Per-User Data**: Each user only sees and manages their own direct message schedules.

### Media Management
- **Upload Media**: Upload images and videos for use in event reminders and scheduled posts.
- **List Media**: View all uploaded media in a personal library.
- **Per-User Data**: Each user has their own private media library.

### WhatsApp API Integration & Settings
- **Settings Page**: A dedicated page for each user to configure their WhatsApp API credentials.
- **Required Credentials**: `API URL`, `API Token`, and `API ID`.
- **Test Functionality**: Users can enter a test mobile number and send a message to validate their API settings before enabling live reminders.
- **Secure Storage**: All settings are stored securely on a per-user basis.

### Frontend
- **AngularJS 1.x SPA**: A dynamic single-page application for a seamless user experience.
- **Responsive UI**: Built with Bootstrap and Tailwind CSS for a modern, responsive interface that works on all devices.
- **AJAX API Calls**: All data is loaded and updated dynamically via RESTful API calls without page reloads.

### Backend
- **Express.js**: A robust REST API for handling authentication, data management, and WhatsApp integration.
- **Secure Sessions & CORS**: Employs secure session management and enables CORS for flexible development.
- **JSON File Storage**: Utilizes JSON files for data storage, making the application portable and easy to set up.
- **User Data Isolation**: All API endpoints ensure that users can only access and modify their own data.
- **Reliable Cron Job**: A background task runs every minute to:
  - Check for scheduled messages that are due.
  - Send messages (both text and media) via the configured WhatsApp API.
  - Update the message status to `Sent` or `Failed` based on the API response.
  - Throttle message sending to prevent rate-limiting issues.

## Project Structure

```
backend/
  app.js
  package.json
  bin/www
  data/
    users.json
    groups.json
    schedule.json
    events.json
    user_media.json
  public/
    frontend/
      index.html
      app.js
      login.html
      register.html
      dashboard.html
      groups.html
      schedules.html
      events.html
      event-reminders.html
      media.html
      tailwind.css
      tailwind.config.js
      ...
    uploads/
    ...
  routes/
    auth.js
    groups.js
    schedule.js
    events.js
    media.js
    wa.js
    users.js
    ...
```

## How to Run

1.  **Install backend dependencies:**
    ```sh
    cd backend
    npm install
    ```

2.  **Start the backend server:**
    ```sh
    npm start
    ```
    The server will start on port 3000.

3.  **Access the app:**
    - Open [http://localhost:3000/frontend/index.html](http://localhost:3000/frontend/index.html) in your browser.

## Event Reminder Workflow

1.  **Configure Settings**: Go to the Settings page and enter your WhatsApp API credentials and a test mobile number. Click "Send Test Message" to verify the integration.
2.  **Create a Group**: Add at least one WhatsApp group.
3.  **Create an Event**: Go to the Events page and create an event with a future date/time.
4.  **Configure Reminders**: Click "Reminders" for the event. For each time slot (5 days before, 1 hour before, etc.), you can:
    - Enable the reminder.
    - Set custom reminder text (use `{{eventName}}` if you wish).
    - Attach an image or video from your media library.
5.  **Save and Schedule**: Click "Save Reminders". The system will automatically generate the necessary entries in the master schedule.
6.  **Monitor Status**: Visit the Schedules page to see all pending and sent reminders and their status. The cron job will handle the rest.

## Notes

- All API endpoints are protected and require a user to be logged in, except for the registration and login pages.
- All user data (groups, events, media, etc.) is completely isolated.
- The backend cron job is robust and includes status tracking (`Sent`/`Failed`) based on the actual response from the WhatsApp API.
