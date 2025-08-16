# Gate Control App

A simple web application for controlling gates via phone calls using Twilio with MySQL database storage.

## Features

- 🚪 Control multiple gates remotely
- 📞 Make phone calls to open gates
- 👑 Admin panel for managing gates
- 💰 View Twilio account balance
- 🔒 Secure admin authentication
- 🗄️ MySQL database storage with automatic setup

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server (5.7+ or MariaDB 10.2+)
- Twilio account with credentials
- Environment variables configured

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Gates
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up MySQL Database**
   
   **Option A: Automatic Setup (Recommended)**
   ```bash
   # The application will automatically create the database and tables
   # Just ensure MySQL is running and create a .env file
   ```
   
   **Option B: Manual Setup**
   ```bash
   # Run the setup script (Windows)
   setup-db.bat
   
   # Or manually create database
   mysql -u root -p -e "CREATE DATABASE gates_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

4. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # MySQL Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=gates_db
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   
   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your-twilio-sid
   TWILIO_AUTH_TOKEN=your-twilio-token
   
   # Admin Authentication
   ADMIN_PASSWORD=your-secret-password
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   ```

5. **Start the application**
   ```bash
   npm start
   ```

   The app will be available at `http://localhost:3001`

## Database Features

- **Automatic Setup**: Tables created automatically on first run
- **Data Seeding**: Initial gate data added automatically
- **Soft Delete**: Gates marked inactive instead of deleted
- **Hebrew Support**: Full UTF8MB4 support for Hebrew text
- **Connection Pooling**: Efficient database management

## Usage

### Opening Gates
- Click the "Open Gate" button on any gate card
- The system will make a phone call to the gate's phone number

### Admin Functions
- **Add Gate**: Create new gates with phone numbers
- **Edit Gate**: Modify existing gate information
- **Delete Gate**: Remove gates from the system (soft delete)
- **View Balance**: Check Twilio account balance

### Security
- Admin password required for all management operations
- Password is validated against the server
- No persistent authentication - password required for each session

## Project Structure

```
Gates/
├── client/              # React frontend
├── server/              # Express backend
│   ├── config/          # Database configuration
│   ├── models/          # Sequelize models
│   └── routes/          # API routes
├── MYSQL_SETUP.md       # Detailed MySQL setup guide
├── setup-db.bat         # Windows database setup script
└── package.json         # Dependencies and scripts
```

## API Endpoints

- `GET /api/gates` - Get all active gates
- `POST /api/gates/:id/open` - Open a gate
- `POST /api/gates` - Create new gate (admin)
- `PUT /api/gates/:id` - Update gate (admin)
- `DELETE /api/gates/:id` - Delete gate (admin, soft delete)
- `GET /api/twilio/balance` - Get Twilio balance (admin)

## Technologies Used

- **Frontend**: React, CSS3
- **Backend**: Node.js, Express
- **Database**: MySQL with Sequelize ORM
- **Communication**: Twilio API
- **Storage**: MySQL database (replaces JSON files)

## Database Schema

The `gates` table includes:
- Gate information (name, phone numbers)
- Call history (last opened, call status, duration)
- Active status and timestamps
- Full Hebrew text support

## Troubleshooting

### MySQL Connection Issues
1. Ensure MySQL service is running
2. Check credentials in `.env` file
3. Verify database `gates_db` exists
4. Check user permissions

### Test Database Connection
```bash
node test-mysql.js
```

## Migration from JSON

The application automatically migrates from the old JSON-based storage:
- New installations use MySQL by default
- Existing JSON data can be manually imported if needed
- All new operations use the database

## License

MIT License
