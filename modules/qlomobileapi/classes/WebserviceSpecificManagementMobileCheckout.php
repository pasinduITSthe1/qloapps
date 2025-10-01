<?php
/**
* Mobile Check-out API Handler
* Handles guest check-out process via mobile app
*/

class WebserviceSpecificManagementMobileCheckout implements WebserviceSpecificManagementInterface
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
     * Handle mobile check-out requests
     */
    public function getContent()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'POST':
                return $this->processCheckout();
            case 'GET':
                return $this->getCheckoutStatus();
            default:
                throw new WebserviceException('Method not allowed', array(80, 405));
        }
    }

    /**
     * Process guest check-out
     */
    private function processCheckout()
    {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        $required = ['booking_id', 'room_condition', 'additional_charges'];
        foreach ($required as $field) {
            if (!isset($input[$field])) {
                throw new WebserviceException("Missing required field: $field", array(81, 400));
            }
        }

        try {
            // Get booking details
            $booking = new HotelBookingDetail($input['booking_id']);
            if (!Validate::isLoadedObject($booking)) {
                throw new WebserviceException('Booking not found', array(82, 404));
            }

            // Check if already checked out
            if ($booking->is_checked_out) {
                throw new WebserviceException('Guest already checked out', array(83, 400));
            }

            // Process checkout
            $booking->is_checked_out = 1;
            $booking->actual_check_out = date('Y-m-d H:i:s');
            $booking->room_condition = $input['room_condition'];
            
            // Handle additional charges if any
            $total_additional = 0;
            if (!empty($input['additional_charges'])) {
                $total_additional = $this->processAdditionalCharges($booking, $input['additional_charges']);
            }
            
            if ($booking->save()) {
                // Update room status
                $this->updateRoomStatus($booking->id_room, 'dirty');
                
                // Calculate final bill
                $final_bill = $this->calculateFinalBill($booking, $total_additional);
                
                // Log the check-out event
                $this->logCheckoutEvent($booking, $input, $final_bill);
                
                $response = array(
                    'success' => true,
                    'message' => 'Guest checked out successfully',
                    'booking_id' => $booking->id,
                    'room_number' => $this->getRoomNumber($booking->id_room),
                    'check_out_time' => $booking->actual_check_out,
                    'final_bill' => $final_bill,
                    'additional_charges' => $total_additional
                );
                
                $this->objOutput->setFieldsToDisplay(array_keys($response));
                return $response;
            } else {
                throw new WebserviceException('Failed to update booking', array(84, 500));
            }
            
        } catch (Exception $e) {
            throw new WebserviceException($e->getMessage(), array(85, 500));
        }
    }

    /**
     * Get check-out status for a booking
     */
    private function getCheckoutStatus()
    {
        $booking_id = isset($_GET['booking_id']) ? (int)$_GET['booking_id'] : 0;
        
        if (!$booking_id) {
            throw new WebserviceException('Booking ID required', array(86, 400));
        }

        $booking = new HotelBookingDetail($booking_id);
        if (!Validate::isLoadedObject($booking)) {
            throw new WebserviceException('Booking not found', array(87, 404));
        }

        $response = array(
            'booking_id' => $booking->id,
            'is_checked_out' => (bool)$booking->is_checked_out,
            'check_out_time' => $booking->actual_check_out,
            'room_number' => $this->getRoomNumber($booking->id_room),
            'guest_name' => $this->getGuestName($booking->id_customer),
            'room_condition' => $booking->room_condition ?? 'pending'
        );

        $this->objOutput->setFieldsToDisplay(array_keys($response));
        return $response;
    }

    /**
     * Process additional charges
     */
    private function processAdditionalCharges($booking, $charges)
    {
        $total = 0;
        foreach ($charges as $charge) {
            if (isset($charge['amount']) && $charge['amount'] > 0) {
                $total += (float)$charge['amount'];
                
                // Log individual charge
                PrestaShopLogger::addLog(
                    "Additional charge for booking {$booking->id}: {$charge['description']} - {$charge['amount']}", 
                    1
                );
            }
        }
        
        return $total;
    }

    /**
     * Calculate final bill
     */
    private function calculateFinalBill($booking, $additional_charges)
    {
        // Get original booking amount
        $order_detail = new OrderDetail($booking->id_order_detail);
        $original_amount = 0;
        
        if (Validate::isLoadedObject($order_detail)) {
            $original_amount = $order_detail->total_price_tax_incl;
        }
        
        return $original_amount + $additional_charges;
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
     * Log check-out event for DTCM tracking
     */
    private function logCheckoutEvent($booking, $input, $final_bill)
    {
        // This will send data to your DTCM backend system
        $log_data = array(
            'event_type' => 'checkout',
            'booking_id' => $booking->id,
            'hotel_id' => $booking->id_hotel,
            'room_id' => $booking->id_room,
            'customer_id' => $booking->id_customer,
            'check_out_time' => $booking->actual_check_out,
            'room_condition' => $booking->room_condition,
            'final_bill' => $final_bill,
            'timestamp' => date('Y-m-d H:i:s')
        );
        
        // TODO: Send to DTCM backend via API call
        // $this->sendToDTCM($log_data);
        
        // For now, log locally
        PrestaShopLogger::addLog('Mobile Check-out: ' . json_encode($log_data), 1);
    }
}