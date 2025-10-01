<?php
/**
* Real-time Room Status API Handler
* Provides current room status for mobile app
*/

class WebserviceSpecificManagementMobileRoomStatus implements WebserviceSpecificManagementInterface
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
     * Handle room status requests
     */
    public function getContent()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'GET':
                return $this->getRoomStatus();
            case 'PUT':
                return $this->updateRoomStatus();
            default:
                throw new WebserviceException('Method not allowed', array(88, 405));
        }
    }

    /**
     * Get room status
     */
    private function getRoomStatus()
    {
        $hotel_id = isset($_GET['hotel_id']) ? (int)$_GET['hotel_id'] : 0;
        $room_id = isset($_GET['room_id']) ? (int)$_GET['room_id'] : 0;
        
        if ($room_id) {
            // Get specific room status
            return $this->getSingleRoomStatus($room_id);
        } elseif ($hotel_id) {
            // Get all rooms for a hotel
            return $this->getHotelRoomsStatus($hotel_id);
        } else {
            throw new WebserviceException('Hotel ID or Room ID required', array(89, 400));
        }
    }

    /**
     * Get single room status
     */
    private function getSingleRoomStatus($room_id)
    {
        $room = new HotelRoomInformation($room_id);
        if (!Validate::isLoadedObject($room)) {
            throw new WebserviceException('Room not found', array(90, 404));
        }

        // Get current booking if any
        $current_booking = $this->getCurrentBooking($room_id);
        
        $response = array(
            'room_id' => $room->id,
            'room_number' => $room->room_num,
            'room_type' => $this->getRoomTypeName($room->id_product),
            'status' => $room->room_status ?? 'available',
            'is_occupied' => !empty($current_booking),
            'current_guest' => $current_booking ? $this->getGuestName($current_booking['id_customer']) : null,
            'check_in_date' => $current_booking ? $current_booking['check_in'] : null,
            'check_out_date' => $current_booking ? $current_booking['check_out'] : null,
            'last_updated' => date('Y-m-d H:i:s')
        );

        $this->objOutput->setFieldsToDisplay(array_keys($response));
        return $response;
    }

    /**
     * Get all rooms status for a hotel
     */
    private function getHotelRoomsStatus($hotel_id)
    {
        $sql = 'SELECT * FROM ' . _DB_PREFIX_ . 'htl_room_information 
                WHERE id_hotel = ' . (int)$hotel_id . ' 
                ORDER BY room_num ASC';
        
        $rooms = Db::getInstance()->executeS($sql);
        $rooms_status = array();
        
        foreach ($rooms as $room) {
            $current_booking = $this->getCurrentBooking($room['id']);
            
            $rooms_status[] = array(
                'room_id' => $room['id'],
                'room_number' => $room['room_num'],
                'room_type' => $this->getRoomTypeName($room['id_product']),
                'status' => $room['room_status'] ?? 'available',
                'is_occupied' => !empty($current_booking),
                'current_guest' => $current_booking ? $this->getGuestName($current_booking['id_customer']) : null,
                'check_in_date' => $current_booking ? $current_booking['check_in'] : null,
                'check_out_date' => $current_booking ? $current_booking['check_out'] : null
            );
        }

        $response = array(
            'hotel_id' => $hotel_id,
            'total_rooms' => count($rooms_status),
            'rooms' => $rooms_status,
            'last_updated' => date('Y-m-d H:i:s')
        );

        $this->objOutput->setFieldsToDisplay(array_keys($response));
        return $response;
    }

    /**
     * Update room status
     */
    private function updateRoomStatus()
    {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['room_id']) || empty($input['status'])) {
            throw new WebserviceException('Room ID and status required', array(91, 400));
        }

        $room = new HotelRoomInformation($input['room_id']);
        if (!Validate::isLoadedObject($room)) {
            throw new WebserviceException('Room not found', array(92, 404));
        }

        // Validate status
        $valid_statuses = array('available', 'occupied', 'dirty', 'maintenance', 'blocked');
        if (!in_array($input['status'], $valid_statuses)) {
            throw new WebserviceException('Invalid status', array(93, 400));
        }

        $room->room_status = $input['status'];
        
        if ($room->save()) {
            // Log the status change
            $this->logStatusChange($room, $input);
            
            $response = array(
                'success' => true,
                'message' => 'Room status updated successfully',
                'room_id' => $room->id,
                'room_number' => $room->room_num,
                'new_status' => $room->room_status,
                'updated_at' => date('Y-m-d H:i:s')
            );
            
            $this->objOutput->setFieldsToDisplay(array_keys($response));
            return $response;
        } else {
            throw new WebserviceException('Failed to update room status', array(94, 500));
        }
    }

    /**
     * Get current booking for a room
     */
    private function getCurrentBooking($room_id)
    {
        $today = date('Y-m-d');
        
        $sql = 'SELECT * FROM ' . _DB_PREFIX_ . 'htl_booking_detail 
                WHERE id_room = ' . (int)$room_id . ' 
                AND check_in <= "' . pSQL($today) . '"
                AND check_out > "' . pSQL($today) . '"
                AND is_checked_in = 1 
                AND (is_checked_out = 0 OR is_checked_out IS NULL)
                LIMIT 1';
        
        return Db::getInstance()->getRow($sql);
    }

    /**
     * Get room type name
     */
    private function getRoomTypeName($product_id)
    {
        $product = new Product($product_id);
        return Validate::isLoadedObject($product) ? $product->name : '';
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
     * Log status change event
     */
    private function logStatusChange($room, $input)
    {
        $log_data = array(
            'event_type' => 'room_status_change',
            'room_id' => $room->id,
            'room_number' => $room->room_num,
            'old_status' => $input['old_status'] ?? 'unknown',
            'new_status' => $room->room_status,
            'changed_by' => $input['changed_by'] ?? 'mobile_app',
            'timestamp' => date('Y-m-d H:i:s')
        );
        
        // TODO: Send to DTCM backend via API call
        // $this->sendToDTCM($log_data);
        
        // For now, log locally
        PrestaShopLogger::addLog('Room Status Change: ' . json_encode($log_data), 1);
    }
}