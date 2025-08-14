# Gate Control App

A simple web application for controlling gates via phone calls using Twilio.

## Features

- 🚪 Control multiple gates remotely
- 📞 Make phone calls to open gates
- 👑 Admin panel for managing gates
- 💰 View Twilio account balance
- 🔒 Secure admin authentication

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
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

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   ADMIN_PASSWORD=your-secret-password
   TWILIO_ACCOUNT_SID=your-twilio-sid
   TWILIO_AUTH_TOKEN=your-twilio-token
   TWILIO_PHONE_NUMBER=your-twilio-number
   ```

4. **Start the application**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Usage

### Opening Gates
- Click the "Open Gate" button on any gate card
- The system will make a phone call to the gate's phone number

### Admin Functions
- **Add Gate**: Create new gates with phone numbers
- **Edit Gate**: Modify existing gate information
- **Delete Gate**: Remove gates from the system
- **View Balance**: Check Twilio account balance

### Security
- Admin password required for all management operations
- Password is validated against the server
- No persistent authentication - password required for each session

## Project Structure

```
Gates/
├── client/          # React frontend
├── server/          # Express backend
├── data/            # Gate data storage
└── package.json     # Dependencies and scripts
```

## API Endpoints

- `GET /api/gates` - Get all gates
- `POST /api/gates/:id/open` - Open a gate
- `POST /api/gates` - Create new gate (admin)
- `PUT /api/gates/:id` - Update gate (admin)
- `DELETE /api/gates/:id` - Delete gate (admin)
- `GET /api/twilio/balance` - Get Twilio balance (admin)

## Technologies Used

- **Frontend**: React, CSS3
- **Backend**: Node.js, Express
- **Communication**: Twilio API
- **Storage**: JSON file system

## License

MIT License
