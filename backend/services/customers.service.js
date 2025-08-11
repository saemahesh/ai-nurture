const fs = require('fs');
const path = require('path');
const moment = require('moment');

class CustomersService {
  constructor() {
    this.customersFile = path.join(__dirname, '../data/customers.json');
    this.enrollmentsFile = path.join(__dirname, '../data/enrollments.json');
    this.sequencesFile = path.join(__dirname, '../data/sequences.json');
    this.messageQueueFile = path.join(__dirname, '../data/message_queue.json');
    this.campaignQueueFile = path.join(__dirname, '../data/campaign_queue.json');
  }

  // Helper functions to read/write data
  readCustomers() {
    try {
      const data = fs.readFileSync(this.customersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  writeCustomers(customers) {
    fs.writeFileSync(this.customersFile, JSON.stringify(customers, null, 2));
  }

  readEnrollments() {
    try {
      const data = fs.readFileSync(this.enrollmentsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  writeEnrollments(enrollments) {
    fs.writeFileSync(this.enrollmentsFile, JSON.stringify(enrollments, null, 2));
  }

  readSequences() {
    try {
      const data = fs.readFileSync(this.sequencesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  readMessageQueue() {
    try {
      const data = fs.readFileSync(this.messageQueueFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  writeMessageQueue(queue) {
    fs.writeFileSync(this.messageQueueFile, JSON.stringify(queue, null, 2));
  }

  readCampaignQueue() {
    try {
      const data = fs.readFileSync(this.campaignQueueFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  writeCampaignQueue(queue) {
    fs.writeFileSync(this.campaignQueueFile, JSON.stringify(queue, null, 2));
  }

  // Get all customers for a user
  getCustomersByUser(username) {
    const customers = this.readCustomers();
    return customers.filter(customer => customer.username === username);
  }

  // Create customer from enrollment
  createCustomerFromEnrollment(enrollment, additionalData = {}) {
    const customers = this.readCustomers();
    
    // Check if customer already exists
    const existingCustomer = customers.find(c => 
      c.phone === enrollment.phone && 
      c.username === enrollment.username
    );

    if (existingCustomer) {
      // Update existing customer with new sequence enrollment
      if (!existingCustomer.enrolledSequences.includes(enrollment.sequence_id)) {
        existingCustomer.enrolledSequences.push(enrollment.sequence_id);
        existingCustomer.lastSequenceEnrollment = enrollment.sequence_id;
        existingCustomer.updated_at = moment().toISOString();
      }
      this.writeCustomers(customers);
      return existingCustomer;
    }

    // Create new customer
    const newCustomer = {
      id: 'customer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      username: enrollment.username,
      phone: enrollment.phone,
      name: enrollment.name || '',
      type: 'lead', // 'lead' or 'paid_customer'
      designation: additionalData.designation || '',
      business: additionalData.business || '',
      servicesNeeded: additionalData.servicesNeeded || '',
      productsInterested: additionalData.productsInterested || '',
      tags: [], // Tags like 'hot_lead', 'warm_lead', 'service_1', 'product_1_interested', etc.
      notes: additionalData.notes || '',
      purchasedProducts: [], // Products/services purchased when converted to paid customer
      enrolledSequences: [enrollment.sequence_id], // Array of sequence IDs customer is enrolled in
      lastSequenceEnrollment: enrollment.sequence_id,
      firstEnrolledAt: enrollment.enrolled_at,
      convertedAt: null, // Date when converted to paid customer
      converted_by: null, // User who converted the lead
      created_at: moment().toISOString(),
      updated_at: moment().toISOString()
    };

    customers.push(newCustomer);
    this.writeCustomers(customers);
    return newCustomer;
  }

  // Get customer by phone and username
  getCustomerByPhone(phone, username) {
    const customers = this.readCustomers();
    return customers.find(c => c.phone === phone && c.username === username);
  }

  // Update customer
  updateCustomer(customerId, updateData, username) {
    const customers = this.readCustomers();
    const customerIndex = customers.findIndex(c => 
      c.id === customerId && c.username === username
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found or you do not have permission to update it');
    }

    // Merge update data with existing customer
    customers[customerIndex] = {
      ...customers[customerIndex],
      ...updateData,
      updated_at: moment().toISOString()
    };

    this.writeCustomers(customers);
    return customers[customerIndex];
  }

  // Convert lead to paid customer
  convertToPaidCustomer(customerId, products, convertedBy, username) {
    const customers = this.readCustomers();
    const customerIndex = customers.findIndex(c => 
      c.id === customerId && c.username === username
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found or you do not have permission to update it');
    }

    const customer = customers[customerIndex];
    
    if (customer.type === 'paid_customer') {
      throw new Error('Customer is already a paid customer');
    }

    // Update customer to paid status
    customers[customerIndex] = {
      ...customer,
      type: 'paid_customer',
      purchasedProducts: products || [],
      convertedAt: moment().toISOString(),
      converted_by: convertedBy,
      updated_at: moment().toISOString()
    };

    this.writeCustomers(customers);

    // Stop nurture sequences for this customer
    this.stopNurtureSequencesForCustomer(customer.phone, username);

    return customers[customerIndex];
  }

  // Stop nurture sequences for converted customer
  stopNurtureSequencesForCustomer(phone, username) {
    try {
      // Update enrollments to stopped status
      const enrollments = this.readEnrollments();
      const updatedEnrollments = enrollments.map(enrollment => {
        if (enrollment.phone === phone && 
            enrollment.username === username && 
            ['active', 'paused'].includes(enrollment.status)) {
          return {
            ...enrollment,
            status: 'stopped',
            stoppedReason: 'converted_to_paid_customer',
            stoppedAt: moment().toISOString()
          };
        }
        return enrollment;
      });
      this.writeEnrollments(updatedEnrollments);

      // Cancel pending messages in message queue
      const messageQueue = this.readMessageQueue();
      const updatedMessageQueue = messageQueue.map(msg => {
        if (msg.phone === phone && 
            msg.username === username && 
            msg.status === 'pending') {
          return { ...msg, status: 'cancelled', cancelledReason: 'customer_converted' };
        }
        return msg;
      });
      this.writeMessageQueue(updatedMessageQueue);

      // Cancel pending messages in campaign queue
      const campaignQueue = this.readCampaignQueue();
      const updatedCampaignQueue = campaignQueue.map(msg => {
        if (msg.phone === phone && 
            msg.username === username && 
            msg.status === 'pending') {
          return { ...msg, status: 'cancelled', cancelledReason: 'customer_converted' };
        }
        return msg;
      });
      this.writeCampaignQueue(updatedCampaignQueue);

      console.log(`🛑 Stopped nurture sequences for converted customer: ${phone}`);
    } catch (error) {
      console.error(`Error stopping nurture sequences for customer ${phone}:`, error);
    }
  }

  // Add tags to customer
  addTagsToCustomer(customerId, tags, username) {
    const customers = this.readCustomers();
    const customerIndex = customers.findIndex(c => 
      c.id === customerId && c.username === username
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found or you do not have permission to update it');
    }

    const customer = customers[customerIndex];
    const newTags = Array.isArray(tags) ? tags : [tags];
    
    // Add new tags without duplicates
    newTags.forEach(tag => {
      if (!customer.tags.includes(tag)) {
        customer.tags.push(tag);
      }
    });

    customers[customerIndex].updated_at = moment().toISOString();
    this.writeCustomers(customers);
    return customers[customerIndex];
  }

  // Remove tags from customer
  removeTagsFromCustomer(customerId, tags, username) {
    const customers = this.readCustomers();
    const customerIndex = customers.findIndex(c => 
      c.id === customerId && c.username === username
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found or you do not have permission to update it');
    }

    const customer = customers[customerIndex];
    const tagsToRemove = Array.isArray(tags) ? tags : [tags];
    
    // Remove tags
    customer.tags = customer.tags.filter(tag => !tagsToRemove.includes(tag));

    customers[customerIndex].updated_at = moment().toISOString();
    this.writeCustomers(customers);
    return customers[customerIndex];
  }

  // Filter customers by tags
  filterCustomersByTags(tags, username) {
    const customers = this.getCustomersByUser(username);
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    
    return customers.filter(customer => 
      tagsArray.some(tag => customer.tags.includes(tag))
    );
  }

  // Filter customers by type
  filterCustomersByType(type, username) {
    const customers = this.getCustomersByUser(username);
    return customers.filter(customer => customer.type === type);
  }

  // Delete customer
  deleteCustomer(customerId, username) {
    const customers = this.readCustomers();
    const customerIndex = customers.findIndex(c => 
      c.id === customerId && c.username === username
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found or you do not have permission to delete it');
    }

    customers.splice(customerIndex, 1);
    this.writeCustomers(customers);
    return true;
  }

  // Get customer analytics
  getCustomerAnalytics(username) {
    const customers = this.getCustomersByUser(username);
    
    const analytics = {
      total: customers.length,
      leads: customers.filter(c => c.type === 'lead').length,
      paidCustomers: customers.filter(c => c.type === 'paid_customer').length,
      recentlyAdded: customers.filter(c => 
        moment().diff(moment(c.created_at), 'days') <= 7
      ).length,
      recentlyConverted: customers.filter(c => 
        c.convertedAt && moment().diff(moment(c.convertedAt), 'days') <= 7
      ).length,
      topTags: this.getTopTags(customers),
      conversionRate: customers.length > 0 ? 
        (customers.filter(c => c.type === 'paid_customer').length / customers.length * 100).toFixed(2) : 0
    };

    return analytics;
  }

  // Get top tags
  getTopTags(customers) {
    const tagCounts = {};
    customers.forEach(customer => {
      customer.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }
}

module.exports = CustomersService;
