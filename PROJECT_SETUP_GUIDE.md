# Hotel Mobile Check-in/Check-out System
## Complete Implementation Guide

This is a comprehensive hotel management ecosystem with three main components:

1. **QloApps** (existing) - Hotel booking website + admin dashboard
2. **Mobile WebApp** (new) - Guest check-in/check-out interface  
3. **DTCM Backend** (new) - Centralized tracking and reporting system

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   QloApps       │    │  Mobile WebApp  │    │  DTCM Backend   │
│   (Existing)    │    │     (New)       │    │     (New)       │
│                 │    │                 │    │                 │
│ • Hotel Admin   │◄──►│ • Check-in/out  │◄──►│ • Data Tracking │
│ • Booking Mgmt  │    │ • Guest Reg.    │    │ • Analytics     │
│ • Reports       │    │ • Room Status   │    │ • Compliance    │
│ • REST API      │    │ • Mobile UI     │    │ • Reporting     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start Guide

### Step 1: Set up QloApps API Extensions

1. **Install the Mobile API Module:**
   ```bash
   # The module is already created in: /modules/qlomobileapi/
   # Go to QloApps Admin > Modules > Upload the module
   ```

2. **Run Database Updates:**
   ```sql
   # Execute the SQL file: /modules/qlomobileapi/mobile_api_db_updates.sql
   # This adds required fields for mobile check-in/check-out
   ```

3. **Configure API Access:**
   - Go to QloApps Admin > Advanced Parameters > Webservice
   - Enable webservice
   - Create a new API key for mobile app access
   - Set permissions for the new mobile API endpoints

### Step 2: Set up Mobile WebApp

1. **Access the Mobile App:**
   ```
   URL: http://your-qloapps-domain.com/mobile-app/
   ```

2. **Configure API Settings:**
   - Edit `/mobile-app/index.html`
   - Update the `API_KEY` variable with your QloApps webservice key
   - Update `API_BASE` URL if needed

### Step 3: Set up DTCM Backend

1. **Install Dependencies:**
   ```bash
   cd dtcm-backend
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration
   ```

3. **Start the Server:**
   ```bash
   npm run dev     # Development mode
   npm start       # Production mode
   ```

## 📊 Available API Endpoints

### QloApps Mobile API Extensions

```http
POST /webservice/mobile_checkin
GET  /webservice/mobile_checkin?booking_id=123

POST /webservice/mobile_checkout
GET  /webservice/mobile_checkout?booking_id=123

GET  /webservice/mobile_room_status?hotel_id=1
PUT  /webservice/mobile_room_status

POST /webservice/mobile_guest_register
```

### DTCM Backend API

```http
# Tracking
POST /api/tracking/event
GET  /api/tracking/events
GET  /api/tracking/live-status/:hotel_id

# Reports
GET  /api/reports/daily/:hotel_id
GET  /api/reports/weekly/:hotel_id
GET  /api/reports/monthly/:hotel_id
GET  /api/reports/dtcm/:hotel_id

# Analytics
GET  /api/analytics/dashboard/:hotel_id
GET  /api/analytics/occupancy/:hotel_id
GET  /api/analytics/revenue/:hotel_id

# Hotels
GET  /api/hotels
POST /api/hotels
PUT  /api/hotels/:hotel_id
```

## 📱 Mobile App Features

### Check-in Process
- Booking ID verification
- Guest ID confirmation
- ID verification method selection
- Digital signature capture
- Automatic room status update

### Check-out Process
- Room condition assessment
- Additional charges handling
- Final bill calculation
- Automatic room status update to "dirty"

### Room Status Management
- Real-time room status viewing
- Status updates (available, occupied, dirty, maintenance)
- Hotel-wide room overview

## 🔄 Integration Workflow

1. **Guest arrives** → Uses mobile app for check-in
2. **Check-in data** → Sent to QloApps API
3. **QloApps** → Updates booking status and room status
4. **Event logged** → Sent to DTCM backend for tracking
5. **DTCM backend** → Processes event, updates analytics
6. **Reports generated** → Available through DTCM dashboard

## 📋 Database Schema Changes

The following tables are modified/created:

```sql
-- Modified: htl_booking_detail
ALTER TABLE htl_booking_detail ADD COLUMN is_checked_in TINYINT(1);
ALTER TABLE htl_booking_detail ADD COLUMN is_checked_out TINYINT(1);
ALTER TABLE htl_booking_detail ADD COLUMN actual_check_in DATETIME;
ALTER TABLE htl_booking_detail ADD COLUMN actual_check_out DATETIME;
-- ... more fields

-- Modified: htl_room_information  
ALTER TABLE htl_room_information ADD COLUMN room_status VARCHAR(20);

-- New: mobile_app_logs
CREATE TABLE mobile_app_logs (...);
```

## 🔧 Configuration

### QloApps Configuration
1. Enable webservice in Admin > Advanced Parameters > Webservice
2. Create API key with appropriate permissions
3. Install and configure the qlomobileapi module

### DTCM Backend Configuration
```env
MONGODB_URI=mongodb://localhost:27017/dtcm_hotel_tracking
QLOAPPS_BASE_URL=http://your-qloapps-domain.com
QLOAPPS_API_KEY=your-webservice-key
```

### Mobile App Configuration
```javascript
const API_BASE = '/webservice';
const API_KEY = 'YOUR_WEBSERVICE_KEY';
```

## 🚨 Security Considerations

1. **API Authentication:** All API calls require valid webservice keys
2. **Rate Limiting:** DTCM backend implements rate limiting
3. **Data Validation:** Input validation on all endpoints
4. **CORS Policy:** Configured for authorized domains only
5. **HTTPS:** Use HTTPS in production for all communications

## 📈 Monitoring & Analytics

### Available Reports
- Daily occupancy and revenue reports
- Weekly trend analysis  
- Monthly compliance reports
- Real-time dashboard metrics
- DTCM-specific compliance tracking

### Key Metrics Tracked
- Check-ins/check-outs
- Room occupancy rates
- Revenue and additional charges
- Guest demographics
- Compliance status
- Room condition tracking

## 🔍 Testing

### Test the Mobile App
1. Access: `http://your-domain.com/mobile-app/`
2. Test check-in with a valid booking ID
3. Test check-out process
4. Verify room status updates

### Test DTCM Backend
1. Health check: `http://localhost:3000/health`
2. API docs: `http://localhost:3000/api/docs`
3. Test event creation via `/api/tracking/event`

## 📞 Support & Maintenance

### Log Files
- QloApps logs: Check admin error logs
- DTCM Backend: Console output and log files
- Database: Monitor MongoDB logs

### Common Issues
1. **API Key Issues:** Verify webservice permissions
2. **Database Connection:** Check MongoDB connection
3. **CORS Errors:** Update allowed origins in .env

## 🎯 Next Steps

1. **Production Deployment:**
   - Set up proper hosting for DTCM backend
   - Configure SSL certificates
   - Set up automated backups

2. **Enhanced Features:**
   - Push notifications for staff
   - Integration with hotel management systems
   - Advanced analytics and forecasting

3. **Compliance:**
   - DTCM reporting automation
   - Audit trail enhancements
   - Data retention policies

## 📊 Performance Optimization

- Database indexing for fast queries
- API response caching
- Image optimization for mobile app
- MongoDB aggregation for analytics

---

**Need Help?** Check the API documentation at `/api/docs` or review the code comments for detailed implementation guidance.