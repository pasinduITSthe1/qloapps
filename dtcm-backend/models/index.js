const mongoose = require('mongoose');

// Hotel Tracking Event Schema
const hotelEventSchema = new mongoose.Schema({
    // Event identification
    event_id: {
        type: String,
        unique: true,
        required: true,
        default: () => `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    event_type: {
        type: String,
        required: true,
        enum: ['checkin', 'checkout', 'room_change', 'room_status_change', 'booking_created', 'booking_cancelled']
    },
    
    // Hotel & Room Info
    hotel_id: {
        type: Number,
        required: true,
        index: true
    },
    hotel_name: String,
    room_id: Number,
    room_number: String,
    room_type: String,
    
    // Guest Info
    booking_id: {
        type: Number,
        required: true,
        index: true
    },
    customer_id: Number,
    guest_name: String,
    guest_email: String,
    guest_phone: String,
    guest_nationality: String,
    
    // Event specific data
    event_data: {
        // Check-in specific
        check_in_time: Date,
        planned_check_in: Date,
        check_in_signature: String,
        id_verification_method: String,
        
        // Check-out specific
        check_out_time: Date,
        planned_check_out: Date,
        room_condition: String,
        additional_charges: [{
            description: String,
            amount: Number
        }],
        final_bill: Number,
        
        // Room status
        old_status: String,
        new_status: String,
        changed_by: String,
        
        // General
        notes: String,
        attachments: [String]
    },
    
    // Tracking metadata
    source_system: {
        type: String,
        default: 'qloapps',
        enum: ['qloapps', 'mobile_app', 'admin_panel', 'api']
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    processed: {
        type: Boolean,
        default: false
    },
    processed_at: Date,
    
    // DTCM compliance fields
    compliance_status: {
        type: String,
        enum: ['pending', 'compliant', 'non_compliant', 'review_required'],
        default: 'pending'
    },
    compliance_notes: String,
    reported_to_dtcm: {
        type: Boolean,
        default: false
    },
    dtcm_report_date: Date,
    
    // Geolocation (if available)
    location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number
    }
}, {
    timestamps: true,
    collection: 'hotel_events'
});

// Indexes for better performance
hotelEventSchema.index({ hotel_id: 1, timestamp: -1 });
hotelEventSchema.index({ event_type: 1, timestamp: -1 });
hotelEventSchema.index({ booking_id: 1, event_type: 1 });
hotelEventSchema.index({ timestamp: -1 });
hotelEventSchema.index({ compliance_status: 1 });

// Hotel Information Schema
const hotelSchema = new mongoose.Schema({
    hotel_id: {
        type: Number,
        unique: true,
        required: true
    },
    hotel_name: {
        type: String,
        required: true
    },
    hotel_address: String,
    hotel_city: String,
    hotel_country: String,
    hotel_phone: String,
    hotel_email: String,
    
    // License and compliance info
    trade_license: String,
    tourism_license: String,
    dtcm_registration: String,
    
    // Configuration
    total_rooms: Number,
    room_types: [{
        type_id: Number,
        type_name: String,
        room_count: Number
    }],
    
    // Integration settings
    api_settings: {
        qloapps_url: String,
        api_key: String,
        sync_enabled: Boolean,
        last_sync: Date
    },
    
    // Status
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'hotels'
});

// Daily Summary Schema for quick reporting
const dailySummarySchema = new mongoose.Schema({
    hotel_id: {
        type: Number,
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    
    // Daily metrics
    total_checkins: { type: Number, default: 0 },
    total_checkouts: { type: Number, default: 0 },
    total_room_changes: { type: Number, default: 0 },
    occupancy_rate: { type: Number, default: 0 },
    average_stay_duration: { type: Number, default: 0 },
    
    // Revenue
    total_revenue: { type: Number, default: 0 },
    additional_charges: { type: Number, default: 0 },
    
    // Room status breakdown
    room_status: {
        available: { type: Number, default: 0 },
        occupied: { type: Number, default: 0 },
        dirty: { type: Number, default: 0 },
        maintenance: { type: Number, default: 0 },
        blocked: { type: Number, default: 0 }
    },
    
    // Guest demographics
    guest_nationalities: [{
        country: String,
        count: Number
    }],
    
    // Compliance status
    compliance_score: { type: Number, default: 100 },
    compliance_issues: [String],
    
    // Auto-generated
    generated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'daily_summaries'
});

// Compound index for efficient queries
dailySummarySchema.index({ hotel_id: 1, date: -1 }, { unique: true });

// Export models
module.exports = {
    HotelEvent: mongoose.model('HotelEvent', hotelEventSchema),
    Hotel: mongoose.model('Hotel', hotelSchema),
    DailySummary: mongoose.model('DailySummary', dailySummarySchema)
};