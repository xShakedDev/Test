# 🚀 Quick Start - תיקון בעיית השמיעה בשיחה

## הבעיה
לא שומעים אחד את השני בשיחה - הדפדפן מקבל מיקרופון אבל לא שומע את הצד השני.

## הפתרון המהיר

### 1. התקנת תלויות
```bash
npm run install-all
```

### 2. הגדרת משתני סביבה
```bash
# העתק את קובץ הדוגמה
copy env.example .env

# ערוך את הקובץ עם הפרטים שלך
# במיוחד:
TWILIO_API_KEY=your_api_key_here
TWILIO_API_SECRET=your_api_secret_here
TWILIO_TWIML_APP_SID=your_twiml_app_sid_here
BASE_URL=https://your-domain.com
```

### 3. הגדרת Twilio Console
1. **יצירת API Key:**
   - לך ל: https://console.twilio.com/tools/api-keys
   - לחץ "Create API Key"
   - שמור את ה-SID וה-Secret

2. **יצירת TwiML App:**
   - לך ל: https://console.twilio.com/voice/manage/twiml-apps
   - לחץ "Create new TwiML App"
   - Request URL: `https://your-domain.com/api/twilio/client-voice`

### 4. הפעלה
```bash
# הפעלת שרת
npm start

# הפעלת לקוח (בטרמינל אחר)
cd client
npm start
```

### 5. בדיקה
- פתח: http://localhost:3001/health
- היכנס לאפליקציה כמנהל
- לך לדף הטלפון
- בדוק ב-Console: "Twilio Device ready"
- נסה שיחה

## פיתוח מקומי עם ngrok
```bash
# התקן ngrok
npm install -g ngrok

# הפעל את השרת
npm start

# הפעל ngrok
ngrok http 3001

# השתמש בכתובת ה-HTTPS כ-BASE_URL
BASE_URL=https://abc123.ngrok.io
```

## מה השתנה?
- ✅ הוספת Twilio Client SDK לתמיכה ב-WebRTC
- ✅ חיבור קול דו-כיווני מלא
- ✅ איכות קול גבוהה
- ✅ חיבור יציב דרך Twilio

## בעיות נפוצות
- **"Twilio Device ready" לא מופיע** - בדוק את משתני הסביבה
- **שגיאת רשת** - ודא שה-BASE_URL נכון
- **לא שומעים** - בדוק שה-TwiML App מוגדר נכון

## תמיכה
אם יש בעיות, בדוק:
1. לוגי שרת בטרמינל
2. Console של הדפדפן
3. משתני סביבה
4. הגדרות Twilio Console
