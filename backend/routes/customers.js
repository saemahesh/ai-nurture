const express = require('express');
const { getDataFilePath } = require('../data-utils');
const router = express.Router();
const CustomersService = require('../services/customers.service');
const moment = require('moment');

const customersService = new CustomersService();

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Apply auth middleware to all routes
router.use(requireAuth);

// Get all customers for authenticated user
router.get('/', (req, res) => {
  try {
    const { type, tags, search } = req.query;
    let customers = customersService.getCustomersByUser(req.session.user.username);

    // Filter by type if specified
    if (type && ['lead', 'paid_customer'].includes(type)) {
      customers = customers.filter(c => c.type === type);
    }

    // Filter by tags if specified
    if (tags) {
      const tagsArray = tags.split(',').map(tag => tag.trim());
      customers = customers.filter(customer => 
        tagsArray.some(tag => customer.tags.includes(tag))
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(customer => 
        (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
        customer.phone.includes(search) ||
        (customer.business && customer.business.toLowerCase().includes(searchLower)) ||
        (customer.designation && customer.designation.toLowerCase().includes(searchLower)) ||
        customer.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    customers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:customerId', (req, res) => {
  try {
    const customers = customersService.getCustomersByUser(req.session.user.username);
    const customer = customers.find(c => c.id === req.params.customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create new customer manually
router.post('/', (req, res) => {
  try {
    const { phone, name, designation, business, servicesNeeded, productsInterested, tags, notes } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if customer already exists
    const existingCustomer = customersService.getCustomerByPhone(phone, req.session.user.username);
    if (existingCustomer) {
      return res.status(400).json({ error: 'Customer with this phone number already exists' });
    }

    // Create enrollment-like object for the service
    const mockEnrollment = {
      username: req.session.user.username,
      phone: phone,
      name: name || '',
      sequence_id: 'manual_entry', // Special identifier for manual entries
      enrolled_at: moment().toISOString()
    };

    const additionalData = {
      designation: designation || '',
      business: business || '',
      servicesNeeded: servicesNeeded || '',
      productsInterested: productsInterested || '',
      notes: notes || ''
    };

    const customer = customersService.createCustomerFromEnrollment(mockEnrollment, additionalData);

    // If tags provided, add them
    if (tags && Array.isArray(tags) && tags.length > 0) {
      customersService.addTagsToCustomer(customer.id, tags, req.session.user.username);
    }

    res.json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:customerId', (req, res) => {
  try {
    const { name, designation, business, servicesNeeded, productsInterested, notes } = req.body;
    
    const updateData = {
      name: name,
      designation: designation,
      business: business,
      servicesNeeded: servicesNeeded,
      productsInterested: productsInterested,
      notes: notes
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const customer = customersService.updateCustomer(
      req.params.customerId, 
      updateData, 
      req.session.user.username
    );

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }
});

// Convert lead to paid customer
router.post('/:customerId/convert', (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required for conversion' });
    }

    const customer = customersService.convertToPaidCustomer(
      req.params.customerId,
      products,
      req.session.user.username,
      req.session.user.username
    );

    res.json({ 
      success: true, 
      message: 'Customer converted to paid customer successfully',
      customer: customer 
    });
  } catch (error) {
    console.error('Error converting customer:', error);
    if (error.message.includes('not found') || error.message.includes('already a paid customer')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to convert customer' });
    }
  }
});

// Add tags to customer
router.post('/:customerId/tags', (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || (!Array.isArray(tags) && typeof tags !== 'string')) {
      return res.status(400).json({ error: 'Tags are required' });
    }

    const customer = customersService.addTagsToCustomer(
      req.params.customerId,
      tags,
      req.session.user.username
    );

    res.json(customer);
  } catch (error) {
    console.error('Error adding tags to customer:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to add tags to customer' });
    }
  }
});

// Remove tags from customer
router.delete('/:customerId/tags', (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || (!Array.isArray(tags) && typeof tags !== 'string')) {
      return res.status(400).json({ error: 'Tags are required' });
    }

    const customer = customersService.removeTagsFromCustomer(
      req.params.customerId,
      tags,
      req.session.user.username
    );

    res.json(customer);
  } catch (error) {
    console.error('Error removing tags from customer:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to remove tags from customer' });
    }
  }
});

// Delete customer
router.delete('/:customerId', (req, res) => {
  try {
    customersService.deleteCustomer(req.params.customerId, req.session.user.username);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete customer' });
    }
  }
});

// Get customer analytics
router.get('/analytics/summary', (req, res) => {
  try {
    const analytics = customersService.getCustomerAnalytics(req.session.user.username);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
});

// Setup follow-up message (redirect to direct schedule with prefilled phone)
router.post('/:customerId/follow-up', (req, res) => {
  try {
    const customers = customersService.getCustomersByUser(req.session.user.username);
    const customer = customers.find(c => c.id === req.params.customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Return customer info for redirect
    res.json({ 
      success: true, 
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name
      },
      redirectUrl: `/direct-schedule?phone=${encodeURIComponent(customer.phone)}&name=${encodeURIComponent(customer.name || '')}`
    });
  } catch (error) {
    console.error('Error setting up follow-up:', error);
    res.status(500).json({ error: 'Failed to setup follow-up' });
  }
});

module.exports = router;
