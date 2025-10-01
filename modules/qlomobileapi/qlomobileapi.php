<?php
/**
* NOTICE OF LICENSE
*
* This source file is subject to the Open Software License version 3.0
* that is bundled with this package in the file LICENSE.md
* It is also available through the world-wide-web at this URL:
* https://opensource.org/license/osl-3-0-php
*
* @author Hotel Mobile Team
* @copyright 2025
* @license https://opensource.org/license/osl-3-0-php Open Software License version 3.0
*/

if (!defined('_PS_VERSION_')) {
    exit;
}

class QloMobileApi extends Module
{
    public function __construct()
    {
        $this->name = 'qlomobileapi';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Hotel Mobile Team';
        $this->need_instance = 0;
        $this->bootstrap = true;
        parent::__construct();
        $this->displayName = $this->l('QloApps Mobile API Extension');
        $this->description = $this->l('Provides API endpoints for mobile check-in/check-out functionality.');
    }

    public function install()
    {
        return parent::install() && $this->registerHook('addWebserviceResources');
    }

    public function uninstall()
    {
        return parent::uninstall();
    }

    public function hookAddWebserviceResources()
    {
        return array(
            'mobile_checkin' => array(
                'description' => 'Mobile guest check-in',
                'specific_management' => true
            ),
            'mobile_checkout' => array(
                'description' => 'Mobile guest check-out', 
                'specific_management' => true
            ),
            'mobile_room_status' => array(
                'description' => 'Real-time room status',
                'specific_management' => true
            ),
            'mobile_guest_register' => array(
                'description' => 'Quick guest registration',
                'specific_management' => true
            )
        );
    }
}