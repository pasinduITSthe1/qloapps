const express = require('express');
const router = express.Router();
const { HotelEvent, DailySummary } = require('../models');

/**
 * GET /api/reports/daily/:hotel_id
 * Generate daily report for a specific hotel
 */
router.get('/daily/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const date = req.query.date ? new Date(req.query.date) : new Date();
        
        // Set date to start of day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Check if summary already exists
        let summary = await DailySummary.findOne({
            hotel_id: hotelId,
            date: startOfDay
        });
        
        if (!summary) {
            // Generate new summary
            summary = await generateDailySummary(hotelId, startOfDay, endOfDay);
        }
        
        res.json({
            hotel_id: hotelId,
            date: startOfDay.toISOString().split('T')[0],
            summary: summary,
            generated_at: summary.generated_at
        });
        
    } catch (error) {
        console.error('Error generating daily report:', error);
        res.status(500).json({
            error: 'Failed to generate daily report',
            details: error.message
        });
    }
});

/**
 * GET /api/reports/weekly/:hotel_id
 * Generate weekly report for a specific hotel
 */
router.get('/weekly/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const endDate = req.query.end_date ? new Date(req.query.end_date) : new Date();
        
        // Calculate start date (7 days ago)
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setHours(23, 59, 59, 999);
        
        // Get daily summaries for the week
        const dailySummaries = await DailySummary.find({
            hotel_id: hotelId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });
        
        // Calculate weekly totals
        const weeklyTotals = {
            total_checkins: 0,
            total_checkouts: 0,
            total_revenue: 0,
            average_occupancy_rate: 0,
            average_stay_duration: 0
        };
        
        dailySummaries.forEach(day => {
            weeklyTotals.total_checkins += day.total_checkins;
            weeklyTotals.total_checkouts += day.total_checkouts;
            weeklyTotals.total_revenue += day.total_revenue;
            weeklyTotals.average_occupancy_rate += day.occupancy_rate;
            weeklyTotals.average_stay_duration += day.average_stay_duration;
        });
        
        // Calculate averages
        const dayCount = dailySummaries.length || 1;
        weeklyTotals.average_occupancy_rate = weeklyTotals.average_occupancy_rate / dayCount;
        weeklyTotals.average_stay_duration = weeklyTotals.average_stay_duration / dayCount;
        
        res.json({
            hotel_id: hotelId,
            period: {
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            weekly_totals: weeklyTotals,
            daily_breakdown: dailySummaries,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error generating weekly report:', error);
        res.status(500).json({
            error: 'Failed to generate weekly report',
            details: error.message
        });
    }
});

/**
 * GET /api/reports/monthly/:hotel_id
 * Generate monthly report for a specific hotel
 */
router.get('/monthly/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
        
        // Calculate start and end dates for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        // Get daily summaries for the month
        const dailySummaries = await DailySummary.find({
            hotel_id: hotelId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });
        
        // Calculate monthly totals
        const monthlyTotals = calculatePeriodTotals(dailySummaries);
        
        // Get compliance summary
        const complianceIssues = await HotelEvent.find({
            hotel_id: hotelId,
            timestamp: { $gte: startDate, $lte: endDate },
            compliance_status: { $in: ['non_compliant', 'review_required'] }
        }).select('event_type compliance_status compliance_notes timestamp');
        
        res.json({
            hotel_id: hotelId,
            period: {
                year: year,
                month: month,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            monthly_totals: monthlyTotals,
            compliance_summary: {
                total_issues: complianceIssues.length,
                issues: complianceIssues
            },
            daily_breakdown: dailySummaries,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).json({
            error: 'Failed to generate monthly report',
            details: error.message
        });
    }
});

/**
 * GET /api/reports/dtcm/:hotel_id
 * Generate DTCM compliance report
 */
router.get('/dtcm/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);
        
        // Get all events in the date range
        const events = await HotelEvent.find({
            hotel_id: hotelId,
            timestamp: { $gte: startDate, $lte: endDate }
        }).sort({ timestamp: 1 });
        
        // Group events by type
        const eventsByType = {
            checkins: events.filter(e => e.event_type === 'checkin'),
            checkouts: events.filter(e => e.event_type === 'checkout'),
            room_changes: events.filter(e => e.event_type === 'room_change')
        };
        
        // Calculate guest statistics
        const guestStats = calculateGuestStatistics(events);
        
        // Compliance summary
        const complianceStats = {
            total_events: events.length,
            compliant_events: events.filter(e => e.compliance_status === 'compliant').length,
            non_compliant_events: events.filter(e => e.compliance_status === 'non_compliant').length,
            pending_review: events.filter(e => e.compliance_status === 'review_required').length
        };
        
        complianceStats.compliance_rate = 
            (complianceStats.compliant_events / complianceStats.total_events * 100).toFixed(2);
        
        res.json({
            hotel_id: hotelId,
            report_period: {
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            summary: {
                total_checkins: eventsByType.checkins.length,
                total_checkouts: eventsByType.checkouts.length,
                total_room_changes: eventsByType.room_changes.length
            },
            guest_statistics: guestStats,
            compliance_summary: complianceStats,
            detailed_events: events,
            generated_at: new Date().toISOString(),
            report_type: 'dtcm_compliance'
        });
        
    } catch (error) {
        console.error('Error generating DTCM report:', error);
        res.status(500).json({
            error: 'Failed to generate DTCM report',
            details: error.message
        });
    }
});

/**
 * Helper function to generate daily summary
 */
async function generateDailySummary(hotelId, startOfDay, endOfDay) {
    // Get all events for the day
    const dayEvents = await HotelEvent.find({
        hotel_id: hotelId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // Calculate metrics
    const checkins = dayEvents.filter(e => e.event_type === 'checkin');
    const checkouts = dayEvents.filter(e => e.event_type === 'checkout');
    const roomChanges = dayEvents.filter(e => e.event_type === 'room_change');
    
    // Calculate revenue
    const totalRevenue = checkouts.reduce((sum, event) => {
        return sum + (event.event_data.final_bill || 0);
    }, 0);
    
    const additionalCharges = checkouts.reduce((sum, event) => {
        const charges = event.event_data.additional_charges || [];
        return sum + charges.reduce((chargeSum, charge) => chargeSum + charge.amount, 0);
    }, 0);
    
    // Guest nationalities
    const nationalities = {};
    dayEvents.forEach(event => {
        if (event.guest_nationality) {
            nationalities[event.guest_nationality] = (nationalities[event.guest_nationality] || 0) + 1;
        }
    });
    
    const guestNationalities = Object.entries(nationalities).map(([country, count]) => ({
        country,
        count
    }));
    
    // Create and save summary
    const summary = new DailySummary({
        hotel_id: hotelId,
        date: startOfDay,
        total_checkins: checkins.length,
        total_checkouts: checkouts.length,
        total_room_changes: roomChanges.length,
        total_revenue: totalRevenue,
        additional_charges: additionalCharges,
        guest_nationalities: guestNationalities,
        // TODO: Calculate occupancy rate, average stay duration
        occupancy_rate: 0,
        average_stay_duration: 0
    });
    
    await summary.save();
    return summary;
}

/**
 * Helper function to calculate period totals
 */
function calculatePeriodTotals(dailySummaries) {
    const totals = {
        total_checkins: 0,
        total_checkouts: 0,
        total_revenue: 0,
        additional_charges: 0,
        average_occupancy_rate: 0,
        average_stay_duration: 0
    };
    
    dailySummaries.forEach(day => {
        totals.total_checkins += day.total_checkins;
        totals.total_checkouts += day.total_checkouts;
        totals.total_revenue += day.total_revenue;
        totals.additional_charges += day.additional_charges;
        totals.average_occupancy_rate += day.occupancy_rate;
        totals.average_stay_duration += day.average_stay_duration;
    });
    
    const dayCount = dailySummaries.length || 1;
    totals.average_occupancy_rate = totals.average_occupancy_rate / dayCount;
    totals.average_stay_duration = totals.average_stay_duration / dayCount;
    
    return totals;
}

/**
 * Helper function to calculate guest statistics
 */
function calculateGuestStatistics(events) {
    const guests = new Set();
    const nationalities = {};
    
    events.forEach(event => {
        if (event.customer_id) {
            guests.add(event.customer_id);
        }
        if (event.guest_nationality) {
            nationalities[event.guest_nationality] = (nationalities[event.guest_nationality] || 0) + 1;
        }
    });
    
    return {
        unique_guests: guests.size,
        total_guest_interactions: events.length,
        nationalities: Object.entries(nationalities).map(([country, count]) => ({
            country,
            count
        }))
    };
}

module.exports = router;