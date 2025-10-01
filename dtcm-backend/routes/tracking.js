const express = require('express');
const router = express.Router();
const { HotelEvent } = require('../models');

/**
 * POST /api/tracking/event
 * Receive and store hotel events from QloApps mobile app
 */
router.post('/event', async (req, res) => {
    try {
        const eventData = req.body;
        
        // Validate required fields
        const requiredFields = ['event_type', 'hotel_id', 'booking_id'];
        for (const field of requiredFields) {
            if (!eventData[field]) {
                return res.status(400).json({
                    error: `Missing required field: ${field}`
                });
            }
        }
        
        // Create new event
        const hotelEvent = new HotelEvent({
            event_type: eventData.event_type,
            hotel_id: eventData.hotel_id,
            hotel_name: eventData.hotel_name,
            room_id: eventData.room_id,
            room_number: eventData.room_number,
            room_type: eventData.room_type,
            booking_id: eventData.booking_id,
            customer_id: eventData.customer_id,
            guest_name: eventData.guest_name,
            guest_email: eventData.guest_email,
            guest_phone: eventData.guest_phone,
            event_data: eventData.event_data || {},
            source_system: eventData.source_system || 'qloapps',
            location: eventData.location
        });
        
        const savedEvent = await hotelEvent.save();
        
        // Trigger async processing
        processEventAsync(savedEvent);
        
        res.status(201).json({
            success: true,
            message: 'Event recorded successfully',
            event_id: savedEvent.event_id,
            timestamp: savedEvent.timestamp
        });
        
    } catch (error) {
        console.error('Error saving hotel event:', error);
        res.status(500).json({
            error: 'Failed to save event',
            details: error.message
        });
    }
});

/**
 * GET /api/tracking/events
 * Retrieve hotel events with filtering
 */
router.get('/events', async (req, res) => {
    try {
        const {
            hotel_id,
            event_type,
            booking_id,
            start_date,
            end_date,
            page = 1,
            limit = 50
        } = req.query;
        
        // Build query
        const query = {};
        
        if (hotel_id) query.hotel_id = parseInt(hotel_id);
        if (event_type) query.event_type = event_type;
        if (booking_id) query.booking_id = parseInt(booking_id);
        
        if (start_date || end_date) {
            query.timestamp = {};
            if (start_date) query.timestamp.$gte = new Date(start_date);
            if (end_date) query.timestamp.$lte = new Date(end_date);
        }
        
        // Execute query with pagination
        const skip = (page - 1) * limit;
        const events = await HotelEvent.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const total = await HotelEvent.countDocuments(query);
        
        res.json({
            events,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_records: total,
                records_per_page: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Error retrieving events:', error);
        res.status(500).json({
            error: 'Failed to retrieve events',
            details: error.message
        });
    }
});

/**
 * GET /api/tracking/events/:event_id
 * Get specific event details
 */
router.get('/events/:event_id', async (req, res) => {
    try {
        const event = await HotelEvent.findOne({ 
            event_id: req.params.event_id 
        }).lean();
        
        if (!event) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }
        
        res.json(event);
        
    } catch (error) {
        console.error('Error retrieving event:', error);
        res.status(500).json({
            error: 'Failed to retrieve event',
            details: error.message
        });
    }
});

/**
 * GET /api/tracking/live-status/:hotel_id
 * Get real-time hotel status
 */
router.get('/live-status/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get today's events
        const todayEvents = await HotelEvent.find({
            hotel_id: hotelId,
            timestamp: { $gte: today }
        }).sort({ timestamp: -1 }).lean();
        
        // Calculate metrics
        const checkins = todayEvents.filter(e => e.event_type === 'checkin').length;
        const checkouts = todayEvents.filter(e => e.event_type === 'checkout').length;
        const roomChanges = todayEvents.filter(e => e.event_type === 'room_change').length;
        
        // Get latest room statuses
        const latestRoomStatuses = await HotelEvent.aggregate([
            {
                $match: {
                    hotel_id: hotelId,
                    event_type: 'room_status_change'
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: '$room_id',
                    latest_status: { $first: '$event_data.new_status' },
                    room_number: { $first: '$room_number' },
                    timestamp: { $first: '$timestamp' }
                }
            }
        ]);
        
        res.json({
            hotel_id: hotelId,
            date: today.toISOString().split('T')[0],
            metrics: {
                checkins_today: checkins,
                checkouts_today: checkouts,
                room_changes_today: roomChanges,
                net_occupancy_change: checkins - checkouts
            },
            room_statuses: latestRoomStatuses,
            last_updated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting live status:', error);
        res.status(500).json({
            error: 'Failed to get live status',
            details: error.message
        });
    }
});

/**
 * Async function to process events (compliance checks, notifications, etc.)
 */
async function processEventAsync(event) {
    try {
        // Mark as processed
        await HotelEvent.findByIdAndUpdate(event._id, {
            processed: true,
            processed_at: new Date()
        });
        
        // TODO: Add compliance checks
        // TODO: Send notifications if needed
        // TODO: Update daily summaries
        
        console.log(`✅ Processed event: ${event.event_id}`);
        
    } catch (error) {
        console.error(`❌ Error processing event ${event.event_id}:`, error);
    }
}

module.exports = router;