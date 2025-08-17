# MongoDB Integration Setup Guide

This guide will help you set up MongoDB for your Gates application.

## 🗄️ Storage Options

Your application now supports **two storage methods**:

### 1. **File-based Storage** (Default)
- ✅ No setup required
- ✅ Works immediately
- ✅ Data stored in `server/data/gates.json`
- ❌ Limited scalability
- ❌ No concurrent user support

### 2. **MongoDB Storage** (Recommended for production)
- ✅ Better performance and scalability
- ✅ Support for multiple concurrent users
- ✅ Advanced querying capabilities
- ✅ Data validation and relationships
- ❌ Requires MongoDB installation/setup

---

## 🚀 Quick Start with MongoDB

### Option A: Local MongoDB (Development)

#### 1. Install MongoDB
**Windows:**
```bash
# Download from: https://www.mongodb.com/try/download/community
# Or using Chocolatey:
choco install mongodb
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y mongodb
```

#### 2. Start MongoDB Service
```bash
# Windows (as service)
net start MongoDB

# macOS/Linux
brew services start mongodb/brew/mongodb-community  # macOS
sudo systemctl start mongodb                        # Linux
```

#### 3. Install Dependencies
```bash
npm install mongoose
```

#### 4. Configure Environment Variables
Copy your `.env` file and add:
```env
USE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/gates
```

### Option B: MongoDB Atlas (Cloud - Recommended for Production)

#### 1. Create Free Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for a free account
3. Create a new cluster (free tier available)

#### 2. Get Connection String
1. In your Atlas dashboard, click "Connect"
2. Choose "Connect your application"
3. Copy the connection string

#### 3. Configure Environment
```env
USE_MONGODB=true
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gates?retryWrites=true&w=majority
```

---

## 🔄 Migration Process

### 1. Install Dependencies
```bash
npm install
```

### 2. Start with File Storage (if new)
```bash
npm run dev
```

### 3. Migrate Existing Data
If you have existing gates in JSON format:
```bash
npm run migrate-to-mongo
```

This will:
- ✅ Connect to MongoDB
- ✅ Transfer all existing gates
- ✅ Create a backup of your JSON file
- ✅ Preserve all gate settings and history

### 4. Switch to MongoDB
Update your `.env` file:
```env
USE_MONGODB=true
```

### 5. Start with MongoDB
```bash
npm run dev:mongo
# or for production:
npm run start:mongo
```

---

## 📋 Available Commands

### Development
```bash
# File-based storage (default)
npm run dev

# MongoDB storage
npm run dev:mongo
```

### Production
```bash
# File-based storage (default)
npm start

# MongoDB storage
npm run start:mongo
```

### Migration & Utilities
```bash
# Migrate data from JSON to MongoDB
npm run migrate-to-mongo

# Install all dependencies (client + server)
npm run install-all
```

---

## 🔍 Verification

### Check System Status
Visit: `http://localhost:3001/api/status`

You should see:
```json
{
  "server": "OK",
  "storage": {
    "type": "MongoDB",
    "useMongoDB": true,
    "mongoConnected": true,
    "mongoStatus": {
      "state": "connected",
      "host": "localhost",
      "port": 27017,
      "name": "gates"
    }
  }
}
```

### Check Database Status
Visit: `http://localhost:3001/api/database/status`

---

## 🛠️ Advanced Configuration

### Environment Variables
```env
# Required for MongoDB
USE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/gates

# Optional MongoDB settings
DB_NAME=gates                    # Database name (default: gates)
MONGO_CONNECT_TIMEOUT=10000     # Connection timeout in ms
MONGO_RECONNECT_INTERVAL=5000   # Reconnection interval in ms
```

### Production Considerations

#### 1. Connection Pooling
The application automatically manages connections with optimal settings.

#### 2. Error Handling
- Automatic fallback to file storage if MongoDB is unavailable
- Graceful error handling with detailed logging
- Retry logic for connection issues

#### 3. Data Backup
```bash
# MongoDB backup (if using local MongoDB)
mongodump --db gates --out ./backup/$(date +%Y%m%d)

# Atlas backup is automatic
```

#### 4. Indexing
The application automatically creates indexes for:
- Phone numbers
- Authorized numbers
- Active status

---

## 🐛 Troubleshooting

### Common Issues

#### "MongoDB not connected"
```bash
# Check if MongoDB is running
# Windows:
net start MongoDB

# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl status mongodb
```

#### "Connection timeout"
- Check your `MONGODB_URI`
- Ensure MongoDB service is running
- For Atlas: check network access and IP whitelist

#### "Authentication failed"
- Verify username/password in connection string
- For Atlas: check database user permissions

#### Migration Issues
```bash
# Check existing data
ls -la server/data/

# Run migration with debug info
DEBUG=* npm run migrate-to-mongo
```

### Getting Help

1. **Check logs**: The application provides detailed logging
2. **System status**: Visit `/api/status` endpoint
3. **Database status**: Visit `/api/database/status` endpoint

---

## 📊 Data Schema

### Gate Document Structure
```javascript
{
  _id: ObjectId("..."),
  name: "שער סירקין שטח",
  phoneNumber: "+972505364453",
  authorizedNumber: "+972548827828",
  password: null,
  lastOpenedAt: Date("2023-..."),
  lastCallStatus: "completed",
  lastCallDuration: "5",
  isActive: true,
  createdAt: Date("2023-..."),
  updatedAt: Date("2023-...")
}
```

### Key Features
- **Validation**: Phone numbers must match international format
- **Soft Delete**: Gates are marked as `isActive: false` instead of deletion
- **Timestamps**: Automatic `createdAt` and `updatedAt` fields
- **Indexing**: Optimized queries for phone numbers and status

---

## 🎉 Success!

Once configured, your application will:
- ✅ Store all gates in MongoDB
- ✅ Support concurrent users
- ✅ Provide better performance
- ✅ Include data validation
- ✅ Maintain backward compatibility

The application seamlessly switches between storage methods based on configuration, so you can always fall back to file storage if needed.
