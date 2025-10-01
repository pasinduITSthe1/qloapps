const express = require('express');
const router = express.Router();
const { HotelEvent, DailySummary } = require('../models');

/**
 * GET /api/analytics/dashboard/:hotel_id
 * Get dashboard analytics for a hotel
 */
router.get('/dashboard/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const days = parseInt(req.query.days) || 30;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // Get daily summaries for the period
        const dailySummaries = await DailySummary.find({
            hotel_id: hotelId,
            date: { $gte: startDate }
        }).sort({ date: 1 });
        
        // Calculate key metrics
        const totalCheckins = dailySummaries.reduce((sum, day) => sum + day.total_checkins, 0);
        const totalCheckouts = dailySummaries.reduce((sum, day) => sum + day.total_checkouts, 0);
        const totalRevenue = dailySummaries.reduce((sum, day) => sum + day.total_revenue, 0);
        const avgOccupancy = dailySummaries.reduce((sum, day) => sum + day.occupancy_rate, 0) / dailySummaries.length;
        
        // Get recent events
        const recentEvents = await HotelEvent.find({
            hotel_id: hotelId
        }).sort({ timestamp: -1 }).limit(10);
        
        res.json({
            hotel_id: hotelId,
            period_days: days,
            metrics: {
                total_checkins: totalCheckins,
                total_checkouts: totalCheckouts,
                total_revenue: totalRevenue,
                average_occupancy: avgOccupancy.toFixed(2),
                net_occupancy_change: totalCheckins - totalCheckouts
            },
            trends: {
                daily_summaries: dailySummaries,
                recent_events: recentEvents
            },
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error generating dashboard analytics:', error);
        res.status(500).json({
            error: 'Failed to generate dashboard analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/analytics/occupancy/:hotel_id
 * Get occupancy analytics
 */
router.get('/occupancy/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);
        
        const occupancyData = await DailySummary.find({
            hotel_id: hotelId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });
        
        // Calculate occupancy trends
        const trends = occupancyData.map(day => ({
            date: day.date,
            occupancy_rate: day.occupancy_rate,
            checkins: day.total_checkins,
            checkouts: day.total_checkouts
        }));
        
        const avgOccupancy = occupancyData.reduce((sum, day) => sum + day.occupancy_rate, 0) / occupancyData.length;
        const maxOccupancy = Math.max(...occupancyData.map(day => day.occupancy_rate));
        const minOccupancy = Math.min(...occupancyData.map(day => day.occupancy_rate));
        
        res.json({
            hotel_id: hotelId,
            period: {
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            summary: {
                average_occupancy: avgOccupancy.toFixed(2),
                max_occupancy: maxOccupancy.toFixed(2),
                min_occupancy: minOccupancy.toFixed(2)
            },
            trends: trends
        });
        
    } catch (error) {
        console.error('Error generating occupancy analytics:', error);
        res.status(500).json({
            error: 'Failed to generate occupancy analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/analytics/revenue/:hotel_id
 * Get revenue analytics
 */
router.get('/revenue/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const period = req.query.period || 'monthly'; // daily, weekly, monthly
        
        let groupBy, dateFormat;
        switch (period) {
            case 'daily':
                groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
                dateFormat = 'daily';
                break;
            case 'weekly':
                groupBy = { $dateToString: { format: "%Y-W%U", date: "$date" } };
                dateFormat = 'weekly';
                break;
            case 'monthly':
            default:
                groupBy = { $dateToString: { format: "%Y-%m", date: "$date" } };
                dateFormat = 'monthly';
                break;
        }
        
        const revenueData = await DailySummary.aggregate([
            {
                $match: { hotel_id: hotelId }
            },
            {
                $group: {
                    _id: groupBy,
                    total_revenue: { $sum: "$total_revenue" },
                    additional_charges: { $sum: "$additional_charges" },
                    total_checkins: { $sum: "$total_checkins" },
                    total_checkouts: { $sum: "$total_checkouts" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);
        
        // Calculate revenue per booking
        const enrichedData = revenueData.map(item => ({
            ...item,
            revenue_per_checkout: item.total_checkouts > 0 ? 
                (item.total_revenue / item.total_checkouts).toFixed(2) : 0
        }));
        
        res.json({
            hotel_id: hotelId,
            period: dateFormat,
            revenue_breakdown: enrichedData,
            summary: {
                total_revenue: revenueData.reduce((sum, item) => sum + item.total_revenue, 0),
                total_additional_charges: revenueData.reduce((sum, item) => sum + item.additional_charges, 0),
                total_checkouts: revenueData.reduce((sum, item) => sum + item.total_checkouts, 0)
            }
        });
        
    } catch (error) {
        console.error('Error generating revenue analytics:', error);
        res.status(500).json({
            error: 'Failed to generate revenue analytics',
            details: error.message
        });
    }
});

module.exports = router;