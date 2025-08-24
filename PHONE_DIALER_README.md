# 📞 Phone Dialer - מנהלי שערים

## תכונות (Features)

- **שיחות טלפון אמיתיות** - ביצוע שיחות טלפון אמיתיות דרך Twilio
- **ממשק טלפון** - ממשק משתמש דמוי טלפון עם מקלדת מספרים
- **היסטוריית שיחות** - מעקב אחר שיחות קודמות
- **שיחות קול מלאות** - תקשורת קול בזמן אמת באמצעות WebRTC
- **בחירת התקן אודיו** - בחירת מיקרופון ספציפי לשיחה
- **בחירת מספר מתקשר** - בחירת מספר הטלפון שממנו מתבצעת השיחה
- **בקרת שיחה מתקדמת** - השתקה, רמקול, הקלטה ואיכות שיחה
- **מעקב איכות שיחה** - ניטור איכות החיבור בזמן אמת

## התקנה (Installation)

### דרישות מקדימות (Prerequisites)
- Node.js 16+ 
- npm או yarn
- חשבון Twilio עם מספר טלפון מאומת
- MongoDB (אופציונלי - אם לא מוגדר, המערכת תעבוד עם אחסון מקומי)
- Twilio API Key ו-API Secret (לשיחות קול WebRTC)
- Twilio TwiML App (לשיחות קול WebRTC)

### משתני סביבה נדרשים (Required Environment Variables)
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_verified_phone_number

# Twilio Client Configuration (for WebRTC voice calls)
TWILIO_API_KEY=your_twilio_api_key_here
TWILIO_API_SECRET=your_twilio_api_secret_here
TWILIO_TWIML_APP_SID=your_twiml_app_sid_here

# Server Configuration
BASE_URL=https://your-domain.com

# Server Configuration
BASE_URL=http://localhost:3001
NODE_ENV=development

# MongoDB (Optional)
MONGODB_URI=mongodb://localhost:27017/gates
```

### התקנה (Installation Steps)
1. **שכפול הפרויקט (Clone the project)**
   ```bash
   git clone <repository-url>
   cd Gates
   ```

2. **התקנת תלויות (Install dependencies)**
   ```bash
   npm run install-all
   ```
   
   או באופן ידני:
   ```bash
   npm install
   cd client
   npm install
   cd ..
   ```

3. **הגדרת משתני סביבה (Set environment variables)**
   ```bash
   copy env.example .env
   # ערוך את הקובץ .env עם הפרטים שלך
   # Edit the .env file with your details
   ```

4. **הגדרת Twilio Client (Configure Twilio Client)**
   
   **א. יצירת API Key ו-API Secret:**
   - היכנס ל-Twilio Console: https://console.twilio.com/
   - לך ל-"Tools" > "API Keys"
   - לחץ על "Create API Key"
   - בחר "Standard" ו-Key Type
   - שמור את ה-API Key SID וה-API Secret
   
   **ב. יצירת TwiML App:**
   - לך ל-"Voice" > "TwiML Apps"
   - לחץ על "Create new TwiML App"
   - תן שם: "Voice Client App"
   - Request URL: `https://your-domain.com/api/twilio/client-voice`
   - שמור את ה-App SID
   
   **ג. עדכון משתני הסביבה:**
   - עדכן את הקובץ `.env` עם הערכים החדשים
   - הגדר `BASE_URL` לכתובת השרת שלך

5. **הפעלת השרת (Start the server)**
   ```bash
   npm start
   ```

6. **הפעלת הלקוח (Start the client)**
   ```bash
   cd client
   npm start
   ```

7. **בדיקה שהכל עובד (Verify Everything Works)**
   
   **א. בדיקת שרת:**
   - פתח: `http://localhost:3001/health`
   - צריך לראות: `{"status":"OK"}`
   
   **ב. בדיקת Twilio:**
   - פתח: `http://localhost:3001/api/status`
   - בדוק שה-Twilio fields מציגים `true`
   
   **ג. בדיקת שיחה:**
   - היכנס לאפליקציה כמנהל
   - לך לדף הטלפון
   - בדוק שאתה רואה "Twilio Device ready" ב-Console
   - נסה לבצע שיחה

## איך זה עובד (How It Works)

### WebRTC עם Twilio Client
המערכת החדשה משתמשת ב-Twilio Client SDK כדי ליצור חיבור WebRTC אמיתי בין הדפדפן לבין השיחה הטלפונית. זה מאפשר:

- **תקשורת קול דו-כיוונית מלאה** - הדפדפן שומע את הצד השני והצד השני שומע את הדפדפן
- **איכות קול גבוהה** - שימוש בטכנולוגיית WebRTC מתקדמת
- **חיבור יציב** - חיבור ישיר דרך Twilio ללא צורך בשרת מתווך

### תהליך השיחה
1. **אתחול** - הדפדפן מקבל אסימון גישה מ-Twilio
2. **התחלת שיחה** - הדפדפן מתחבר ל-Twilio דרך WebRTC
3. **חיבור טלפון** - Twilio מחבר את השיחה למספר הטלפון המבוקש
4. **תקשורת דו-כיוונית** - הקול עובר בשני הכיוונים דרך WebRTC

## שימוש (Usage)

### ביצוע שיחה (Making a Call)

1. **בחירת מיקרופון (Select Microphone)**
   - בחר את המיקרופון הרצוי מהרשימה הנפתחת
   - Select the desired microphone from the dropdown

2. **בחירת מספר מתקשר (Select Caller ID)**
   - בחר את מספר הטלפון שממנו תתבצע השיחה
   - מספרים אלה הם אותם מספרים מאומתים המשמשים לפתיחת שערים
   - Select the phone number to call from (must be verified with Twilio)
   - These are the same verified numbers used for opening gates

3. **הזנת מספר טלפון (Enter Phone Number)**
   - הזן את מספר הטלפון של הנמען
   - Enter the recipient's phone number

4. **הרשאת מיקרופון (Microphone Permission)**
   - אשר גישה למיקרופון כאשר הדפדפן מבקש
   - Allow microphone access when the browser requests it

5. **התחלת השיחה (Start Call)**
   - לחץ על כפתור "התחל שיחה" (הכפתור הירוק)
   - Click the "Start Call" button (green button)

### בקרת שיחה מתקדמת (Advanced Call Control)

#### השתקה (Mute)
- לחץ על כפתור ההשתקה כדי לעצור את המיקרופון
- Click the mute button to stop the microphone

#### רמקול (Speaker)
- התאם את עוצמת הרמקול באמצעות כפתור הרמקול
- Adjust speaker volume using the speaker button

#### הקלטה (Recording)
- כפתור הקלטה זמין לשימוש עתידי
- Recording button available for future use

#### החלפת התקן אודיו (Audio Device Switching)
- שנה מיקרופון במהלך שיחה פעילה
- Change microphone during an active call

#### מעקב איכות (Quality Monitoring)
- צפה באיכות החיבור בזמן אמת
- View connection quality in real-time

## נקודות קצה API (API Endpoints)

### שיחות טלפון (Phone Calls)
- `POST /api/twilio/make-call` - ביצוע שיחה חדשה
- `POST /api/twilio/end-call` - סיום שיחה פעילה
- `GET /api/twilio/call-history` - היסטוריית שיחות
- `POST /api/twilio/call-status` - עדכוני סטטוס שיחה (webhook)
- `POST /api/twilio/call-offer` - הצעת WebRTC לשיחות קול
- `GET /api/twilio/phone-numbers` - רשימת מספרי טלפון מאומתים

### פרמטרים למימוש שיחה (Call Parameters)
```json
{
  "phoneNumber": "+1234567890",
  "userId": "user_id_here",
  "userName": "username_here",
  "enableVoice": true,
  "fromNumber": "+0987654321"
}
```

## דרישות טכניות (Technical Requirements)

### דפדפן (Browser)
- דפדפן תואם WebRTC (Chrome, Firefox, Safari, Edge)
- WebRTC-compatible browser (Chrome, Firefox, Safari, Edge)

### אודיו (Audio)
- מיקרופון ורמקול מחוברים
- Microphone and Speaker connected
- הרשאת מיקרופון בדפדפן
- Microphone permission in browser

### רשת (Network)
- חיבור אינטרנט יציב
- Stable internet connection
- גישה לשרתי STUN של Google
- Access to Google STUN servers

### פיתוח מקומי (Local Development)
- **ngrok** - לשימוש בפיתוח מקומי:
  ```bash
  # התקן ngrok
  npm install -g ngrok
  
  # הפעל את השרת שלך על פורט 3001
  npm start
  
  # הפעל ngrok בפורט אחר
  ngrok http 3001
  
  # השתמש בכתובת ה-HTTPS שתקבל כ-BASE_URL
  BASE_URL=https://abc123.ngrok.io
  ```

## פתרון בעיות (Troubleshooting)

### בעיות נפוצות (Common Issues)

#### "נדרשת הרשאת מיקרופון" (Microphone Permission Required)
- **פתרון**: אשר גישה למיקרופון בהגדרות הדפדפן
- **Solution**: Allow microphone access in browser settings

#### "לא נמצא מיקרופון מחובר" (No Microphone Found)
- **פתרון**: בדוק חיבור המיקרופון והרשאות הדפדפן
- **Solution**: Check microphone connection and browser permissions

#### "שגיאת רשת" (Network Error)
- **פתרון**: בדוק חיבור האינטרנט וזמינות Twilio
- **Solution**: Check internet connection and Twilio availability

#### "יתרת Twilio נמוכה" (Low Twilio Balance)
- **פתרון**: הוסף כסף לחשבון Twilio שלך
- **Solution**: Add funds to your Twilio account

#### "לא שומעים אחד את השני בשיחה" (No Two-Way Audio)
- **פתרון**: ודא שהגדרת Twilio Client כראוי:
  1. בדוק שה-API Key ו-API Secret מוגדרים נכון
  2. ודא שה-TwiML App SID מוגדר ומופנה לנתיב הנכון
  3. בדוק שה-BASE_URL מוגדר לכתובת נכונה
  4. השתמש ב-ngrok לפיתוח מקומי
- **Solution**: Ensure Twilio Client is properly configured:
  1. Check that API Key and API Secret are set correctly
  2. Verify TwiML App SID is set and points to the correct endpoint
  3. Ensure BASE_URL is set to the correct address
  4. Use ngrok for local development

### לוגים (Logs)
- בדוק את לוגי השרת לפרטים על שגיאות
- Check server logs for error details
- לוגי לקוח זמינים ב-Console של הדפדפן
- Client logs available in browser Console

## אבטחה (Security)

### אימות (Authentication)
- נדרש תפקיד מנהל לגישה לדף הטלפון
- Admin role required to access phone dialer
- אימות JWT לכל בקשות API
- JWT authentication for all API requests

### הרשאות (Permissions)
- רק מנהלים יכולים לבצע שיחות טלפון
- Only admins can make phone calls
- בדיקת יתרת Twilio לפני כל שיחה
- Twilio balance check before each call

## תמיכה (Support)

### דיווח באגים (Bug Reports)
- דווח על בעיות דרך GitHub Issues
- Report issues through GitHub Issues
- כלול פרטים על הדפדפן והמערכת
- Include browser and system details

### בקשות תכונות (Feature Requests)
- הצע תכונות חדשות דרך GitHub Issues
- Suggest new features through GitHub Issues
- תאר את השימוש המבוקש בפירוט
- Describe the desired use case in detail

---

## מה תוקן (What Was Fixed)

### בעיה מקורית
המערכת הישנה לא תמכה בתקשורת קול דו-כיוונית אמיתית. למרות שהיה מיקרופון בדפדפן, לא היה חיבור WebRTC אמיתי בין הדפדפן לבין השיחה הטלפונית.

### הפתרון
- **הוספת Twilio Client SDK** - תמיכה מלאה ב-WebRTC
- **חיבור קול דו-כיווני** - הדפדפן שומע את הצד השני והצד השני שומע את הדפדפן
- **איכות קול גבוהה** - שימוש בטכנולוגיית WebRTC מתקדמת
- **חיבור יציב** - חיבור ישיר דרך Twilio ללא צורך בשרת מתווך

### שינויים טכניים
- עדכון `PhoneDialer.js` לתמיכה ב-Twilio Client SDK
- הוספת נתיב `/api/twilio/token` לאסימון גישה
- הוספת נתיב `/api/twilio/client-voice` לטיפול בשיחות WebRTC
- עדכון משתני סביבה לתמיכה ב-Twilio Client
- הוספת Twilio Client SDK ל-HTML

---

**הערה**: דף הטלפון זמין רק למנהלים במערכת
**Note**: Phone dialer is only available to system administrators
