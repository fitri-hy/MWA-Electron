const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'pos');
const vendorPath = path.join(configDir, 'vendor.json');
const inventoryPath = path.join(configDir, 'inventory.json');
const customerPath = path.join(configDir, 'customer.json');
const invoicePath = path.join(configDir, 'invoice.json');
const addStockRecordPath = path.join(configDir, 'add-stock-record.json');
const writeOffStockRecordPath = path.join(configDir, 'write-off-stock-record.json');
const storeDir = path.join(homeDir, '.config', 'M-WA', 'store');
const storeInfoPath = path.join(storeDir, 'info.json');

const filePaths = {
  vendor: vendorPath,
  inventory: inventoryPath,
  customer: customerPath,
  invoice: invoicePath,
  addStockRecord: addStockRecordPath,
  writeOffStockRecord: writeOffStockRecordPath
};

const ensureFilesExist = () => {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  Object.entries(filePaths).forEach(([name, file]) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]', 'utf-8');
    }
  });
};

const watchFiles = () => {
  Object.entries(filePaths).forEach(([name, file]) => {
    fs.watch(file, (eventType) => {
      if (eventType === 'change') {
        // console.log(`[WATCH] ${name}.json changed at ${new Date().toLocaleTimeString()}`);
      }
    });
  });
};

function findStoreLogo() {
  if (!fs.existsSync(storeDir)) return null;

  const files = fs.readdirSync(storeDir);
  const logoFile = files.find(file => /^store\.(png|jpg|jpeg|svg)$/i.test(file));
  if (logoFile) {
    const fullPath = path.join(storeDir, logoFile);
    const normalizedPath = fullPath.replace(/\\/g, '/');
    return 'file://' + encodeURI(normalizedPath);
  }
  return null;
}

function invoice(res, darkMode) {
  ensureFilesExist();

  fs.readFile(customerPath, 'utf-8', (err, customerData) => {
    if (err) {
      console.error('Failed to read customer.json:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    fs.readFile(inventoryPath, 'utf-8', (err, inventoryData) => {
      if (err) {
        console.error('Failed to read inventory.json:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      fs.readFile(invoicePath, 'utf-8', (err, invoiceData) => {
        if (err) {
          console.error('Failed to read invoices.json:', err);
          res.status(500).send('Internal Server Error');
          return;
        }

        fs.readFile(storeInfoPath, 'utf-8', (err, storeInfoData) => {
          if (err) {
            console.error('Failed to read info.json:', err);
            res.status(500).send('Internal Server Error');
            return;
          }

          let customers, inventory, invoices, storeInfo;
          try {
            customers = JSON.parse(customerData);
            inventory = JSON.parse(inventoryData);
            invoices = JSON.parse(invoiceData);
            storeInfo = JSON.parse(storeInfoData);
          } catch {
            console.error('Failed to parse JSON');
            res.status(500).send('Internal Server Error');
            return;
          }

          const inventoryMap = new Map(inventory.map(item => [item.id, item]));
          const customerMap = new Map(customers.map(c => [c.id, c]));

          invoices.sort((a, b) => b.id - a.id);

          invoices = invoices.map(inv => {
            const enhancedItems = inv.inventory.map(item => {
              const foundItem = inventoryMap.get(item.id_item);
              return {
                ...item,
                item: foundItem?.item || 'Unknown',
                price: foundItem?.price || 0
              };
            });

            return {
              ...inv,
              id_customer: Number(inv.id_customer),
              customer: customerMap.get(Number(inv.id_customer)) || { name: 'Unknown' },
              inventory: enhancedItems
            };
          });

          const logoPath = findStoreLogo() || '/assets/images/logo.png';

          res.render('pos-invoice', {
            darkMode,
            title: 'Invoice | M-WA',
            customers,
            inventory,
            invoices,
            storeInfo,
            logoPath
          });
        });
      });
    });
  });
}

function createInvoice({ date, invoice, id_customer, total, inventory }) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let inventories = [];
  if (fs.existsSync(inventoryPath)) {
    try {
      inventories = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    } catch (e) {
      throw new Error('Failed to parse inventory.json');
    }
  } else {
    throw new Error('Inventory.json file not found');
  }

  for (const item of inventory) {
    const invItem = inventories.find(i => i.id === item.id_item);
    if (!invItem) {
      throw new Error(`Item with id ${item.id_item} was not found in inventory.`);
    }
    const qtyReq = parseInt(item.qty, 10);
    if (invItem.stock < qtyReq) {
      throw new Error(`Stock for item "${invItem.item}" not enough. Stock: ${invItem.stock}, Requested: ${qtyReq}`);
    }
  }

  for (const item of inventory) {
    const invItem = inventories.find(i => i.id === item.id_item);
    const qtyToReduce = parseInt(item.qty, 10);
    invItem.stock -= qtyToReduce;
  }

  fs.writeFileSync(inventoryPath, JSON.stringify(inventories, null, 2), 'utf8');

  let invoices = [];
  if (fs.existsSync(invoicePath)) {
    try {
      invoices = JSON.parse(fs.readFileSync(invoicePath, 'utf8'));
    } catch (e) {
      invoices = [];
    }
  } else {
    fs.writeFileSync(invoicePath, '[]');
  }

  const maxId = invoices.reduce((max, curr) => Math.max(max, curr.id || 0), 0);
  const newId = maxId + 1;

  const newInvoice = {
    id: newId,
    date,
    invoice,
    id_customer,
    total,
    inventory
  };

  invoices.push(newInvoice);
  fs.writeFileSync(invoicePath, JSON.stringify(invoices, null, 2), 'utf8');

  return newInvoice;
}

// Vendor
function vendor(req, res, darkMode) {
  const ITEMS_PER_PAGE = 50;

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(vendorPath)) {
    fs.writeFileSync(vendorPath, '[]');
  }

  if (!global.vendorWatcher) {
    global.vendorWatcher = fs.watch(vendorPath, (eventType, filename) => {
      if (eventType === 'change') {
        // console.log('vendor.json changed');
      }
    });
  }

  fs.readFile(vendorPath, 'utf8', (err, data) => {
    let vendors = [];
    if (!err) {
      try {
        vendors = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
      }
    }

    const q = (req.query.q || '').toLowerCase().trim();
    const page = parseInt(req.query.page) || 1;

    let filteredVendors = vendors;
    if (q) {
      filteredVendors = vendors.filter(vendor => 
        vendor.vendor.toLowerCase().includes(q)
      );
    }

    const totalItems = filteredVendors.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedVendors = filteredVendors.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    res.render('pos-vendor', {
      darkMode,
      title: 'Vendor | M-WA',
      vendors: paginatedVendors,
      currentPage,
      totalPages,
      query: q,
    });
  });
}

function addVendor(name) {
  let vendors = [];
  if (fs.existsSync(vendorPath)) {
    try {
      vendors = JSON.parse(fs.readFileSync(vendorPath, 'utf8'));
    } catch {}
  }

  const id = vendors.reduce((max, v) => v.id > max ? v.id : max, 0) + 1;
  const newVendor = { id, vendor: name };
  vendors.push(newVendor);

  fs.writeFileSync(vendorPath, JSON.stringify(vendors, null, 2));
  return newVendor;
}

function editVendor(id, newName) {
  if (!fs.existsSync(vendorPath)) return null;
  let vendors;
  try {
    vendors = JSON.parse(fs.readFileSync(vendorPath, 'utf8'));
  } catch {
    return null;
  }

  const index = vendors.findIndex(v => v.id === id);
  if (index === -1) return null;

  vendors[index].vendor = newName;
  fs.writeFileSync(vendorPath, JSON.stringify(vendors, null, 2));
  return vendors[index];
}

function deleteVendor(id) {
  if (!fs.existsSync(vendorPath)) return false;
  let vendors;
  try {
    vendors = JSON.parse(fs.readFileSync(vendorPath, 'utf8'));
  } catch {
    return false;
  }

  const filtered = vendors.filter(v => v.id !== id);
  if (filtered.length === vendors.length) return false;

  fs.writeFileSync(vendorPath, JSON.stringify(filtered, null, 2));
  return true;
}

// Inventory
function inventory(req, res, darkMode) {
  const ITEMS_PER_PAGE = 50;

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(inventoryPath)) {
    fs.writeFileSync(inventoryPath, '[]');
  }

  if (!fs.existsSync(vendorPath)) {
    fs.writeFileSync(vendorPath, '[]');
  }

  if (!global.inventoryWatcher) {
    global.inventoryWatcher = fs.watch(inventoryPath, (eventType, filename) => {
      if (eventType === 'change') {
        // console.log('inventory.json changed');
      }
    });
  }

  fs.readFile(inventoryPath, 'utf8', (err, data) => {
    let inventorys = [];
    if (!err) {
      try {
        inventorys = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse inventory.json:', e);
      }
    }

    const q = (req.query.q || '').toLowerCase().trim();
    const page = parseInt(req.query.page) || 1;

    let filteredInventorys = inventorys;
    if (q) {
      filteredInventorys = inventorys.filter(inventory =>
        inventory.item.toLowerCase().includes(q)
      );
    }

    const totalItems = filteredInventorys.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedInventorys = filteredInventorys.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    fs.readFile(vendorPath, 'utf8', (vendorErr, vendorData) => {
      let vendors = [];
      if (!vendorErr) {
        try {
          vendors = JSON.parse(vendorData);
        } catch (e) {
          console.error('Failed to parse vendor.json:', e);
        }
      }
	  
	  const vendorMap = {};
	  vendors.forEach(v => {
	    vendorMap[v.id] = v.vendor;
	  });

	  const joinedInventorys = paginatedInventorys.map(item => ({
	    ...item,
	    vendor_name: vendorMap[item.vendor_id] || 'Unknown Vendor'
  	  }));

      res.render('pos-inventory', {
        darkMode,
        title: 'Inventory | M-WA',
        inventorys: joinedInventorys,
        currentPage,
        totalPages,
        query: q,
        vendors
      });
    });
  });
}

function addInventory(vendor_id, item, stock, cogs, price) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  if (!fs.existsSync(inventoryPath)) {
    fs.writeFileSync(inventoryPath, '[]');
  }

  const data = fs.readFileSync(inventoryPath, 'utf8');
  let inventorys = [];
  try {
    inventorys = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse inventory.json:', e);
    inventorys = [];
  }

  const maxId = inventorys.reduce((max, curr) => Math.max(max, curr.id || 0), 0);
  const newId = maxId + 1;

  const newInventory = {
    id: newId,
    vendor_id,
    item,
    stock: 0,
    cogs,
    price
  };

  inventorys.push(newInventory);

  fs.writeFileSync(inventoryPath, JSON.stringify(inventorys, null, 2), 'utf8');

  return newInventory;
}

function editInventory(id, updatedData) {
  if (!fs.existsSync(inventoryPath)) return null;

  let inventorys;
  try {
    inventorys = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch {
    return null;
  }

  const index = inventorys.findIndex(item => item.id === id);
  if (index === -1) return null;

  inventorys[index] = { ...inventorys[index], ...updatedData };

  fs.writeFileSync(inventoryPath, JSON.stringify(inventorys, null, 2));
  return inventorys[index];
}

function deleteInventory(id) {
  if (!fs.existsSync(inventoryPath)) {
    return false;
  }

  let inventorys = [];
  try {
    const data = fs.readFileSync(inventoryPath, 'utf8');
    inventorys = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse inventory.json:', e);
    return false;
  }

  const filtered = inventorys.filter(item => item.id !== id);

  if (filtered.length === inventorys.length) {
    return false;
  }

  try {
    fs.writeFileSync(inventoryPath, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write inventory.json:', e);
    return false;
  }
}

function addStockInventory(id, additionalStock, desc = '', date = null) {
  if (!fs.existsSync(inventoryPath)) return null;

  let inventorys;
  try {
    inventorys = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch {
    return null;
  }

  const index = inventorys.findIndex(item => item.id === parseInt(id));
  if (index === -1) return null;

  const currentStock = parseInt(inventorys[index].stock || 0);
  const addedStock = parseInt(additionalStock);
  if (isNaN(addedStock)) return null;

  inventorys[index].stock = currentStock + addedStock;
  fs.writeFileSync(inventoryPath, JSON.stringify(inventorys, null, 2));

  if (!fs.existsSync(addStockRecordPath)) {
    fs.writeFileSync(addStockRecordPath, '[]');
  }

  let stockRecords;
  try {
    stockRecords = JSON.parse(fs.readFileSync(addStockRecordPath, 'utf8'));
  } catch {
    stockRecords = [];
  }

  const newId = stockRecords.reduce((max, curr) => Math.max(max, curr.id || 0), 0) + 1;

  const recordDate = date ? date : new Date().toISOString().split('T')[0];

  const newRecord = {
    id: newId,
    item_id: parseInt(id),
    stock: addedStock,
    desc: desc,
    date: recordDate
  };

  stockRecords.push(newRecord);
  fs.writeFileSync(addStockRecordPath, JSON.stringify(stockRecords, null, 2));

  return inventorys[index];
}

function writeOffStockInventory(id, writeOffAmount, desc = '', date = null) {
  if (!fs.existsSync(inventoryPath)) return null;

  let inventorys;
  try {
    inventorys = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch {
    return null;
  }

  const index = inventorys.findIndex(item => item.id === parseInt(id));
  if (index === -1) return null;

  const currentStock = parseInt(inventorys[index].stock || 0);
  const reduceAmount = parseInt(writeOffAmount);
  if (isNaN(reduceAmount) || reduceAmount < 1) return null;
  if (reduceAmount > currentStock) return null;

  inventorys[index].stock = currentStock - reduceAmount;
  fs.writeFileSync(inventoryPath, JSON.stringify(inventorys, null, 2));

  if (!fs.existsSync(writeOffStockRecordPath)) {
    fs.writeFileSync(writeOffStockRecordPath, '[]');
  }

  let writeOffRecords;
  try {
    writeOffRecords = JSON.parse(fs.readFileSync(writeOffStockRecordPath, 'utf8'));
  } catch {
    writeOffRecords = [];
  }

  const newId = writeOffRecords.reduce((max, curr) => Math.max(max, curr.id || 0), 0) + 1;
  const recordDate = date ? date : new Date().toISOString().split('T')[0];

  const newRecord = {
    id: newId,
    item_id: parseInt(id),
    stock: reduceAmount,
    desc: desc,
    date: recordDate
  };

  writeOffRecords.push(newRecord);
  fs.writeFileSync(writeOffStockRecordPath, JSON.stringify(writeOffRecords, null, 2));

  return inventorys[index];
}

// Customer
function customer(req, res, darkMode) {
  const ITEMS_PER_PAGE = 50;

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(customerPath)) {
    fs.writeFileSync(customerPath, '[]');
  }

  if (!global.customerWatcher) {
    global.customerWatcher = fs.watch(customerPath, (eventType, filename) => {
      if (eventType === 'change') {
        // console.log('customer.json changed');
      }
    });
  }

  fs.readFile(customerPath, 'utf8', (err, data) => {
    let customers = [];
    if (!err) {
      try {
        customers = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
      }
    }

    const q = (req.query.q || '').toLowerCase().trim();
    const page = parseInt(req.query.page) || 1;

    let filteredCustomers = customers;
    if (q) {
      filteredCustomers = customers.filter(cust => 
        (cust.name || '').toLowerCase().includes(q)
      );
    }

    const totalItems = filteredCustomers.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    res.render('pos-customer', {
      darkMode,
      title: 'Customer | M-WA',
      customers: paginatedCustomers,
      currentPage,
      totalPages,
      query: q,
    });
  });
}

function addCustomer({ name, phone, city, state, code_pos, address }) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(customerPath)) {
    fs.writeFileSync(customerPath, '[]');
  }

  const data = fs.readFileSync(customerPath, 'utf8');
  let customers = [];
  try {
    customers = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse customer.json:', e);
    customers = [];
  }

  const maxId = customers.reduce((max, curr) => Math.max(max, curr.id || 0), 0);
  const newId = maxId + 1;

  const newCustomer = {
    id: newId,
    name,
    phone,
    city,
    state,
    code_pos,
    address
  };

  customers.push(newCustomer);
  fs.writeFileSync(customerPath, JSON.stringify(customers, null, 2), 'utf8');

  return newCustomer;
}

function deleteCustomer(id) {
  if (!fs.existsSync(customerPath)) {
    return false;
  }

  const data = fs.readFileSync(customerPath, 'utf8');
  let customers = [];
  try {
    customers = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse customer.json:', e);
    return false;
  }

  const originalLength = customers.length;
  customers = customers.filter(customer => customer.id !== id);

  if (customers.length === originalLength) {
    return false;
  }

  try {
    fs.writeFileSync(customerPath, JSON.stringify(customers, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write customer.json:', e);
    return false;
  }
}

function editCustomer(id, updatedData) {
  if (!fs.existsSync(customerPath)) {
    return false;
  }

  const data = fs.readFileSync(customerPath, 'utf8');
  let customers = [];
  try {
    customers = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse customer.json:', e);
    return false;
  }

  const index = customers.findIndex(customer => customer.id === id);
  if (index === -1) {
    return false;
  }

  customers[index] = { ...customers[index], ...updatedData };

  try {
    fs.writeFileSync(customerPath, JSON.stringify(customers, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write customer.json:', e);
    return false;
  }
}

// Report
function report(res, darkMode) {
  fs.readFile(invoicePath, 'utf-8', (err, invoiceData) => {
    if (err) return res.status(500).send('Failed to read invoice.json');

    fs.readFile(inventoryPath, 'utf-8', (err, inventoryData) => {
      if (err) return res.status(500).send('Failed to read inventory.json');

      fs.readFile(customerPath, 'utf-8', (err, customerData) => {
        if (err) return res.status(500).send('Failed to read customer.json');

        fs.readFile(vendorPath, 'utf-8', (err, vendorData) => {
          if (err) return res.status(500).send('Failed to read vendor.json');

          fs.readFile(addStockRecordPath, 'utf-8', (err, addStockData) => {
            if (err) return res.status(500).send('Failed to read add-stock-record.json');

            fs.readFile(writeOffStockRecordPath, 'utf-8', (err, writeOffStockData) => {
              if (err) return res.status(500).send('Failed to read write-off-stock-record.json');

              fs.readFile(storeInfoPath, 'utf-8', (err, storeInfoData) => {
                if (err) {
                  console.error('Failed to read info.json:', err);
                  return res.status(500).send('Failed to read info.json');
                }

                let invoices = [];
                let inventory = [];
                let customers = [];
                let vendors = [];
                let addStocks = [];
                let writeOffStocks = [];
                let storeInfo;

                try {
                  invoices = JSON.parse(invoiceData);
                  inventory = JSON.parse(inventoryData);
                  customers = JSON.parse(customerData);
                  vendors = JSON.parse(vendorData);
                  addStocks = JSON.parse(addStockData);
                  writeOffStocks = JSON.parse(writeOffStockData);
                  storeInfo = JSON.parse(storeInfoData);
                } catch {
                  return res.status(500).send('Invalid JSON');
                }

                const inventoryMap = new Map(inventory.map(item => [item.id, item]));
                const customerMap = new Map(customers.map(c => [Number(c.id), c]));
                const vendorMap = new Map(vendors.map(v => [v.id, v.vendor]));

                invoices = invoices.map(inv => {
                  let totalQty = 0;
                  let totalCOGS = 0;
                  let totalPrice = 0;

                  const enrichedItems = inv.inventory.map(i => {
                    const item = inventoryMap.get(i.id_item);
                    const qty = Number(i.qty) || 0;
                    const price = Number(item?.price || 0);
                    const cogs = Number(item?.cogs || 0);
                    const vendor = vendorMap.get(item?.vendor_id) || 'Unknown';

                    totalQty += qty;
                    totalPrice += price * qty;
                    totalCOGS += cogs * qty;

                    return {
                      ...i,
                      item: item?.item || 'Unknown',
                      price,
                      cogs,
                      vendor
                    };
                  });

                  const firstItem = enrichedItems[0];
                  const vendorName = firstItem?.vendor || 'Unknown';

                  return {
                    ...inv,
                    customer: customerMap.get(Number(inv.id_customer)) || { name: 'Unknown' },
                    inventory: enrichedItems,
                    itemCount: enrichedItems.length,
                    totalQty,
                    totalPrice,
                    totalCOGS,
                    profit: totalPrice - totalCOGS,
                    vendor: vendorName
                  };
                });

                let invoicesByVendor = [];

                invoices.forEach(inv => {
                  const itemsByVendor = {};

                  inv.inventory.forEach(i => {
                    const item = inventoryMap.get(i.id_item);
                    const qty = Number(i.qty) || 0;
                    const price = Number(item?.price || 0);
                    const cogs = Number(item?.cogs || 0);
                    const vendorName = vendorMap.get(item?.vendor_id) || 'Unknown';

                    if (!itemsByVendor[vendorName]) {
                      itemsByVendor[vendorName] = {
                        vendor: vendorName,
                        invoice: inv.invoice,
                        date: inv.date,
                        customer: customerMap.get(Number(inv.id_customer)) || { name: 'Unknown' },
                        inventory: [],
                        totalQty: 0,
                        totalPrice: 0,
                        totalCOGS: 0,
                        profit: 0,
                      };
                    }

                    itemsByVendor[vendorName].inventory.push({
                      ...i,
                      item: item?.item || 'Unknown',
                      price,
                      cogs,
                      qty,
                      vendor: vendorName,
                    });

                    itemsByVendor[vendorName].totalQty += qty;
                    itemsByVendor[vendorName].totalPrice += price * qty;
                    itemsByVendor[vendorName].totalCOGS += cogs * qty;
                  });

                  Object.values(itemsByVendor).forEach(vendorInvoice => {
                    vendorInvoice.profit = vendorInvoice.totalPrice - vendorInvoice.totalCOGS;
                    invoicesByVendor.push(vendorInvoice);
                  });
                });

                let totalItem = 0;
                let totalQty = 0;
                let totalCOGS = 0;
                let totalPrice = 0;
                let totalProfit = 0;

                invoicesByVendor.forEach(inv => {
                  totalItem += inv.inventory.length;
                  totalQty += inv.totalQty;
                  totalCOGS += inv.totalCOGS;
                  totalPrice += inv.totalPrice;
                  totalProfit += inv.profit;
                });

                const totalInvoiceCount = invoices.length;
                const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
                const totalCustomers = customers.length;
                const totalVendors = vendors.length;

                addStocks.sort((a, b) => b.id - a.id);
                writeOffStocks.sort((a, b) => b.id - a.id);

                const logoPath = findStoreLogo() || '/assets/images/logo.png';

                res.render('pos-report', {
                  darkMode,
                  title: 'Report | M-WA',
                  invoices,
                  invoicesByVendor,
                  totalItem,
                  totalQty,
                  totalCOGS,
                  totalPrice,
                  totalProfit,
                  totalInvoiceCount,
                  totalInvoiceAmount,
                  totalCustomers,
                  totalVendors,
                  addStocks,
                  writeOffStocks,
                  inventoryMap,
                  customers,
                  inventory,
                  storeInfo,
                  logoPath
                });
              });
            });
          });
        });
      });
    });
  });
}

function deleteInvoice(id) {
  try {
    const invoices = JSON.parse(fs.readFileSync(invoicePath, 'utf-8'));
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));

    const invoiceIndex = invoices.findIndex(inv => Number(inv.id) === Number(id));
    if (invoiceIndex === -1) return false;

    const invoiceToDelete = invoices[invoiceIndex];

    invoiceToDelete.inventory.forEach(invItem => {
      const item = inventory.find(i => Number(i.id) === Number(invItem.id_item));
      if (item) {
        item.stock = (Number(item.stock) || 0) + Number(invItem.qty || 0);
      }
    });

    invoices.splice(invoiceIndex, 1);

    fs.writeFileSync(invoicePath, JSON.stringify(invoices, null, 2));
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));

    return true;
  } catch (err) {
    console.error('Delete error:', err);
    return false;
  }
}

ensureFilesExist();
watchFiles();

module.exports = {
  invoice, createInvoice, deleteInvoice,
  vendor, addVendor, editVendor, deleteVendor,
  inventory, addInventory, editInventory, deleteInventory, addStockInventory, writeOffStockInventory,
  customer, addCustomer, editCustomer, deleteCustomer,
  report
};
