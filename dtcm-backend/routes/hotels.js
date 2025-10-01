const express = require('express');
const router = express.Router();
const { Hotel } = require('../models');

/**
 * GET /api/hotels
 * Get all hotels
 */
router.get('/', async (req, res) => {
    try {
        const hotels = await Hotel.find({ is_active: true })
            .select('-api_settings.api_key') // Don't expose API keys
            .sort({ hotel_name: 1 });
        
        res.json({
            hotels: hotels,
            total: hotels.length
        });
        
    } catch (error) {
        console.error('Error retrieving hotels:', error);
        res.status(500).json({
            error: 'Failed to retrieve hotels',
            details: error.message
        });
    }
});

/**
 * GET /api/hotels/:hotel_id
 * Get specific hotel details
 */
router.get('/:hotel_id', async (req, res) => {
    try {
        const hotel = await Hotel.findOne({ 
            hotel_id: parseInt(req.params.hotel_id),
            is_active: true 
        }).select('-api_settings.api_key');
        
        if (!hotel) {
            return res.status(404).json({
                error: 'Hotel not found'
            });
        }
        
        res.json(hotel);
        
    } catch (error) {
        console.error('Error retrieving hotel:', error);
        res.status(500).json({
            error: 'Failed to retrieve hotel',
            details: error.message
        });
    }
});

/**
 * POST /api/hotels
 * Register new hotel
 */
router.post('/', async (req, res) => {
    try {
        const hotelData = req.body;
        
        // Check if hotel already exists
        const existingHotel = await Hotel.findOne({ 
            hotel_id: hotelData.hotel_id 
        });
        
        if (existingHotel) {
            return res.status(409).json({
                error: 'Hotel with this ID already exists'
            });
        }
        
        const hotel = new Hotel(hotelData);
        const savedHotel = await hotel.save();
        
        // Remove sensitive data from response
        const response = savedHotel.toObject();
        delete response.api_settings.api_key;
        
        res.status(201).json({
            success: true,
            message: 'Hotel registered successfully',
            hotel: response
        });
        
    } catch (error) {
        console.error('Error registering hotel:', error);
        res.status(500).json({
            error: 'Failed to register hotel',
            details: error.message
        });
    }
});

/**
 * PUT /api/hotels/:hotel_id
 * Update hotel information
 */
router.put('/:hotel_id', async (req, res) => {
    try {
        const hotelId = parseInt(req.params.hotel_id);
        const updateData = req.body;
        
        const updatedHotel = await Hotel.findOneAndUpdate(
            { hotel_id: hotelId },
            updateData,
            { new: true, runValidators: true }
        ).select('-api_settings.api_key');
        
        if (!updatedHotel) {
            return res.status(404).json({
                error: 'Hotel not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Hotel updated successfully',
            hotel: updatedHotel
        });
        
    } catch (error) {
        console.error('Error updating hotel:', error);
        res.status(500).json({
            error: 'Failed to update hotel',
            details: error.message
        });
    }
});

module.exports = router;