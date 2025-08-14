# Gate Control App

A modern gate control application that uses Twilio for phone verification and gate opening through phone calls.

## Features

- **Phone Number Verification**: Users must verify their phone number through Twilio before accessing the app
- **Gate Management**: Add, edit, and delete gates with custom names and phone numbers
- **Secure Access**: Only verified phone numbers can control gates
- **Phone Call Integration**: Open gates by making Twilio calls from verified numbers to gate numbers
- **Modern UI**: Clean, responsive React frontend with intuitive controls

## Prerequisites

- Node.js (v16 or higher)
- Twilio account with:
  - Account SID
  - Auth Token
  - Verified phone number
- npm or yarn package manager

## Installation

1. Clone or download this repository
2. Install server dependencies:
   ```bash
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd client
   npm install
   cd ..
   ```

4. Copy the environment file and configure your Twilio credentials:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Twilio credentials:
   - `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER`: Your verified Twilio phone number

## Usage

### Development Mode
Run both server and client in development mode:
```bash
npm run dev
```

### Production Mode
Build the client and start the server:
```bash
npm run build
npm start
```

## How It Works

1. **Phone Verification**: Users enter their phone number and receive a verification call from Twilio
2. **Gate Management**: Verified users can add gates with names and phone numbers
3. **Gate Control**: Users can trigger gate opening by making Twilio calls from their verified number to the gate number

## API Endpoints

- `POST /api/verify-phone` - Initiate phone verification
- `POST /api/verify-code` - Complete phone verification with code
- `GET /api/gates` - Get all gates for verified user
- `POST /api/gates` - Add new gate
- `PUT /api/gates/:id` - Update gate
- `DELETE /api/gates/:id` - Delete gate
- `POST /api/gates/:id/open` - Open specific gate

## Security Features

- Phone number verification through Twilio
- Session-based authentication
- Authorized access control for gate management

## File Structure

```
├── server/           # Backend Express server
│   ├── index.js     # Main server file
│   ├── routes/      # API route handlers
│   └── middleware/  # Custom middleware
├── client/          # React frontend
│   ├── src/         # Source code
│   ├── public/      # Static assets
│   └── package.json # Frontend dependencies
├── package.json     # Backend dependencies
└── README.md        # This file
```

## Troubleshooting

- Ensure your Twilio credentials are correct in the `.env` file
- Check that your Twilio phone number is verified
- Verify that your Twilio account has sufficient credits for making calls
- Check the console for any error messages

## License

MIT License - feel free to use this project for your own purposes.
