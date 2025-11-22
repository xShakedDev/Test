# הוראות Deployment ל-Google Cloud Service

## הגדרת JWT_SECRET (חשוב מאוד!)

**⚠️ קריטי:** אם `JWT_SECRET` לא מוגדר נכון או משתנה בין deployments, כל המשתמשים המחוברים יתנתקו!

### איך להגדיר JWT_SECRET ב-Google Cloud Run:

1. **היכנס ל-Google Cloud Console**
   - לך ל: https://console.cloud.google.com/

2. **נווט ל-Cloud Run**
   - בחר את הפרויקט שלך
   - לך ל: **Cloud Run** > בחר את השירות שלך

3. **הוסף משתנה סביבה**
   - לחץ על **Edit & Deploy New Revision**
   - גלול למטה ל-**Variables & Secrets**
   - לחץ על **Add Variable**
   - הוסף:
     - **Name:** `JWT_SECRET`
     - **Value:** (הכנס מפתח סודי חזק, למשל: `openssl rand -base64 32`)
   - לחץ על **Deploy**

### יצירת JWT_SECRET חזק:

```bash
# ב-Linux/Mac:
openssl rand -base64 32

# ב-Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### ⚠️ חשוב:

- **אל תשנה את JWT_SECRET אחרי deployment!** זה יגרום לכל המשתמשים להתנתק.
- **שמור את ה-JWT_SECRET במקום בטוח** - תצטרך אותו לכל deployment.
- **השתמש באותו JWT_SECRET לכל ה-deployments** של אותו שירות.

### בדיקה:

אחרי ה-deployment, בדוק את הלוגים:
- אם אתה רואה אזהרה על `JWT_SECRET`, זה אומר שהוא לא מוגדר נכון.
- אם המשתמשים מתנתקים אחרי deployment, זה אומר שה-JWT_SECRET השתנה.

## משתני סביבה נוספים שצריך להגדיר:

1. **JWT_SECRET** - (חובה!) מפתח סודי לחתימת טוקנים
2. **MONGODB_URI** - כתובת MongoDB
3. **TWILIO_ACCOUNT_SID** - Twilio Account SID
4. **TWILIO_AUTH_TOKEN** - Twilio Auth Token
5. **TWILIO_PHONE_NUMBER** - מספר טלפון Twilio
6. **ADMIN_PASSWORD** - סיסמת אדמין
7. **NODE_ENV** - `production`

## טיפים:

- השתמש ב-**Secrets Manager** של Google Cloud לשמירת סודות במקום משתני סביבה רגילים.
- בדוק את הלוגים אחרי כל deployment כדי לוודא שהכל עובד.
- שמור גיבוי של כל משתני הסביבה במקום בטוח.

