<?php
/**
* Mobile Check-in API Handler
* Handles guest check-in process via mobile app
*/

class WebserviceSpecificManagementMobileCheckin implements WebserviceSpecificManagementInterface
{
    protected $objOutput;
    protected $output;

    public function setUrlSegment($segments)
    {
        $this->urlSegment = $segments;
        return $this;
    }

    public function getUrlSegment()
    {
        return $this->urlSegment;
    }

    public function setWsObject(WebserviceOutputBuilder $obj)
    {
        $this->objOutput = $obj;
        return $this;
    }

    /**
     * Handle mobile check-in requests
     */
    public function getContent()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'POST':
                return $this->processCheckin();
            case 'GET':
                return $this->getCheckinStatus();
            default:
                throw new WebserviceException('Method not allowed', array(73, 405));
        }
    }

    /**
     * Process guest check-in
     */
    private function processCheckin()
    {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        $required = ['booking_id', 'guest_id', 'id_verification', 'signature'];
        foreach ($required as $field) {
            if (empty($input[$field])) {
                throw new WebserviceException("Missing required field: $field", array(74, 400));
            }
        }

        try {
            // Get booking details
            $booking = new HotelBookingDetail($input['booking_id']);
            if (!Validate::isLoadedObject($booking)) {
                throw new WebserviceException('Booking not found', array(75, 404));
            }

            // Update booking status to checked-in
            $booking->is_checked_in = 1;
            $booking->actual_check_in = date('Y-m-d H:i:s');
            $booking->check_in_signature = $input['signature'];
            $booking->id_verification_method = $input['id_verification'];
            
            if ($booking->save()) {
                // Update room status
                $this->updateRoomStatus($booking->id_room, 'occupied');
                
                // Log the check-in event
                $this->logCheckinEvent($booking, $input);
                
                $response = array(
                    'success' => true,
                    'message' => 'Guest checked in successfully',
                    'booking_id' => $booking->id,
                    'room_number' => $this->getRoomNumber($booking->id_room),
                    'check_in_time' => $booking->actual_check_in
                );
                
                $this->objOutput->setFieldsToDisplay(array_keys($response));
                return $response;
            } else {
                throw new WebserviceException('Failed to update booking', array(76, 500));
            }
            
        } catch (Exception $e) {
            throw new WebserviceException($e->getMessage(), array(77, 500));
        }
    }

    /**
     * Get check-in status for a booking
     */
    private function getCheckinStatus()
    {
        $booking_id = isset($_GET['booking_id']) ? (int)$_GET['booking_id'] : 0;
        
        if (!$booking_id) {
            throw new WebserviceException('Booking ID required', array(78, 400));
        }

        $booking = new HotelBookingDetail($booking_id);
        if (!Validate::isLoadedObject($booking)) {
            throw new WebserviceException('Booking not found', array(79, 404));
        }

        $response = array(
            'booking_id' => $booking->id,
            'is_checked_in' => (bool)$booking->is_checked_in,
            'check_in_time' => $booking->actual_check_in,
            'room_number' => $this->getRoomNumber($booking->id_room),
            'guest_name' => $this->getGuestName($booking->id_customer)
        );

        $this->objOutput->setFieldsToDisplay(array_keys($response));
        return $response;
    }

    /**
     * Update room status
     */
    private function updateRoomStatus($room_id, $status)
    {
        $room = new HotelRoomInformation($room_id);
        if (Validate::isLoadedObject($room)) {
            $room->room_status = $status;
            $room->save();
        }
    }

    /**
     * Get room number
     */
    private function getRoomNumber($room_id)
    {
        $room = new HotelRoomInformation($room_id);
        return Validate::isLoadedObject($room) ? $room->room_num : '';
    }

    /**
     * Get guest name
     */
    private function getGuestName($customer_id)
    {
        $customer = new Customer($customer_id);
        return Validate::isLoadedObject($customer) ? $customer->firstname . ' ' . $customer->lastname : '';
    }

    /**
     * Log check-in event for DTCM tracking
     */
    private function logCheckinEvent($booking, $input)
    {
        // This will send data to your DTCM backend system
        $log_data = array(
            'event_type' => 'checkin',
            'booking_id' => $booking->id,
            'hotel_id' => $booking->id_hotel,
            'room_id' => $booking->id_room,
            'customer_id' => $booking->id_customer,
            'check_in_time' => $booking->actual_check_in,
            'timestamp' => date('Y-m-d H:i:s')
        );
        
        // TODO: Send to DTCM backend via API call
        // $this->sendToDTCM($log_data);
        
        // For now, log locally
        PrestaShopLogger::addLog('Mobile Check-in: ' . json_encode($log_data), 1);
    }
}