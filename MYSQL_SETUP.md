# MySQL Setup for Gates Application

This guide will help you set up MySQL database for the Gates application.

## Prerequisites

1. **MySQL Server** - Install MySQL 5.7+ or MariaDB 10.2+
2. **Node.js** - Version 14+ recommended
3. **npm** - For installing dependencies

## Installation Steps

### 1. Install MySQL Dependencies

```bash
npm install mysql2 sequelize
```

### 2. Database Configuration

Create a `.env` file in the root directory with the following variables:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gates_db
DB_USER=root
DB_PASSWORD=your_mysql_password_here

# Other required variables
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
ADMIN_PASSWORD=your_admin_password_here
PORT=3001
NODE_ENV=development
```

### 3. Create MySQL Database

#### Option A: Using MySQL Command Line

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE gates_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (optional, for security)
CREATE USER 'gates_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON gates_db.* TO 'gates_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

#### Option B: Using the Schema File

```bash
# Run the schema file
mysql -u root -p < server/config/schema.sql
```

### 4. Start the Application

```bash
# Start the server
npm start
```

The application will automatically:
- Connect to MySQL
- Create the `gates` table if it doesn't exist
- Seed initial data if the table is empty

## Database Schema

The `gates` table contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | INT | Primary key, auto-increment |
| `name` | VARCHAR(255) | Gate name (Hebrew supported) |
| `phone_number` | VARCHAR(20) | Gate phone number |
| `authorized_number` | VARCHAR(20) | Authorized phone number |
| `last_opened_at` | DATETIME | Last time gate was opened |
| `last_call_status` | VARCHAR(50) | Last call status |
| `last_call_duration` | INT | Last call duration in seconds |
| `is_active` | BOOLEAN | Whether gate is active |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Record last update time |

## Features

- **Automatic Table Creation**: Tables are created automatically on first run
- **Data Seeding**: Initial gate data is added automatically
- **Soft Delete**: Gates are marked inactive instead of being deleted
- **Hebrew Support**: Full support for Hebrew text with UTF8MB4 encoding
- **Connection Pooling**: Efficient database connection management

## Troubleshooting

### Connection Issues

1. **Check MySQL Service**: Ensure MySQL is running
   ```bash
   # Windows
   net start mysql
   
   # Linux/Mac
   sudo systemctl start mysql
   ```

2. **Verify Credentials**: Check username/password in `.env` file

3. **Check Port**: Ensure MySQL is running on port 3306 (default)

### Permission Issues

```sql
-- Grant all privileges to user
GRANT ALL PRIVILEGES ON gates_db.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Character Set Issues

```sql
-- Check current character set
SHOW VARIABLES LIKE 'character_set%';

-- Set proper character set
SET NAMES utf8mb4;
```

## Migration from JSON

If you're migrating from the old JSON-based storage:

1. The application will automatically create the MySQL table
2. Existing data in `gates.json` will be ignored
3. New data will be stored in MySQL
4. You can manually import old data if needed

## Backup and Restore

### Backup
```bash
mysqldump -u root -p gates_db > gates_backup.sql
```

### Restore
```bash
mysql -u root -p gates_db < gates_backup.sql
```

## Security Notes

1. **Change Default Passwords**: Always change default MySQL passwords
2. **Limit User Privileges**: Create specific users with minimal required privileges
3. **Network Security**: Restrict MySQL access to localhost in production
4. **Environment Variables**: Never commit `.env` files to version control

## Support

For issues related to:
- **MySQL Setup**: Check this guide and MySQL documentation
- **Application Issues**: Check the application logs and error messages
- **Data Migration**: Ensure proper backup before making changes
