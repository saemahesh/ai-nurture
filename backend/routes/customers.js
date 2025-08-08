const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const router = express.Router();

// Import authentication middleware
const { requireAuth } = require('../middleware/auth');

const customersFile = path.join(__dirname, '../data/customers.json');
const enrollmentsFile = path.join(__dirname, '../data/enrollments.json');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Helper functions
function readCustomers() {
  try {
    const data = fs.readFileSync(customersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeCustomers(customers) {
  fs.writeFileSync(customersFile, JSON.stringify(customers, null, 2));
}

function readEnrollments() {
    try {
      const data = fs.readFileSync(enrollmentsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  function writeEnrollments(enrollments) {
    fs.writeFileSync(enrollmentsFile, JSON.stringify(enrollments, null, 2));
  }

// Get all customers
router.get('/', (req, res) => {
    try {
        const customers = readCustomers();
        const { tags } = req.query;

        if (tags) {
            const tagsArray = tags.split(',');
            const filteredCustomers = customers.filter(c => tagsArray.every(tag => c.tags.includes(tag)));
            res.json(filteredCustomers);
        } else {
            res.json(customers);
        }
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Update a customer
router.put('/:customerId', (req, res) => {
    try {
        const customers = readCustomers();
        const customerIndex = customers.findIndex(c => c.id === req.params.customerId);

        if (customerIndex === -1) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const { status, tags, products_purchased, designation, business, services_needed } = req.body;
        const customer = customers[customerIndex];

        if (status) {
            customer.status = status;
            if (status === 'paid') {
                // Stop nurturing sequences
                const enrollments = readEnrollments();
                const updatedEnrollments = enrollments.map(e => {
                    if (e.phone === customer.phone && e.status === 'active') {
                        e.status = 'stopped';
                    }
                    return e;
                });
                writeEnrollments(updatedEnrollments);
            }
        }
        if (tags) {
            customer.tags = tags;
        }
        if (products_purchased) {
            customer.products_purchased = products_purchased;
        }
        if (designation) {
            customer.designation = designation;
        }
        if (business) {
            customer.business = business;
        }
        if (services_needed) {
            customer.services_needed = services_needed;
        }

        customers[customerIndex] = customer;
        writeCustomers(customers);

        res.json({ success: true, customer });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

module.exports = router;
