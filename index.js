let rowCounterArea = 1;
let rowCounterManual = 1;
let currentlyEditingRowIdArea = null;
let currentlyEditingRowIdManual = null;
let historyStackArea = [];
let historyIndexArea = -1;
let historyStackManual = [];
let historyIndexManual = -1;
let rateColumnHidden = false;
let currentMode = 'area'; // 'area' or 'manual'
let currentView = 'input'; // NEW: Tracks the main view: 'input' or 'bill'

// Theme cycling variables
const themes = ['blue', 'green', 'red', 'purple', 'orange', 'dark'];
let currentThemeIndex = 0;

// Drag and drop variables
let dragSrcEl = null;

// GST and Discount variables
let discountPercent = 0;
let gstPercent = 0;

// Utility to get current state variables
function getModeSpecificVars() {
    if (currentMode === 'area') {
        return {
            rowCounter: rowCounterArea,
            currentlyEditingRowId: currentlyEditingRowIdArea,
            historyStack: historyStackArea,
            historyIndex: historyIndexArea,
            createListId: 'createListArea',
            copyListId: 'copyListArea',
            totalAmountId: 'createTotalAmountArea',
            copyTotalAmountId: 'copyTotalAmount',
            localStorageKey: 'billDataArea',
            historyStorageKey: 'billHistoryArea',
            addRowFunc: addRowArea,
            updateRowFunc: updateRowArea,
            editRowFunc: editRowArea,
            removeRowFunc: removeRowArea
        };
    } else {
        return {
            rowCounter: rowCounterManual,
            currentlyEditingRowId: currentlyEditingRowIdManual,
            historyStack: historyStackManual,
            historyIndex: historyIndexManual,
            createListId: 'createListManual',
            copyListId: 'copyListManual',
            totalAmountId: 'createTotalAmountManual',
            copyTotalAmountId: 'copyTotalAmount',
            localStorageKey: 'billDataManual',
            historyStorageKey: 'billHistoryManual',
            addRowFunc: addRowManual,
            updateRowFunc: updateRowManual,
            editRowFunc: editRowManual,
            removeRowFunc: removeRowManual
        };
    }
}

// Initialize history and load saved data/theme when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSavedMode(); // Load the last saved mode first
    loadFromLocalStorage(); // Load bill data for the current mode
    loadHistoryFromLocalStorage(); // Load history for the current mode
    loadSavedTheme(); // Load saved theme
    loadTaxSettings(); // Load tax settings
    saveStateToHistory(); // Save the initial state to history

    // Automatically set the current date in dd-mm-yyyy format
    const dateInput = document.getElementById('billDate');
    if (dateInput && !dateInput.value) { // Only set if the input is empty
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        const year = today.getFullYear();
        dateInput.value = `${day}-${month}-${year}`;
        saveToLocalStorage(); // Save the date to local storage
    }

    // Start autosave every 60 seconds
    setInterval(autoSave, 60000);
});

// --- Discount Modal Functions ---
function openDiscountModal() {
    const modal = document.getElementById('discount-modal');
    const discountInput = document.getElementById('discount-input');
    
    // Set current discount value
    discountInput.value = discountPercent;
    
    modal.style.display = 'block';
}

function closeDiscountModal() {
    const modal = document.getElementById('discount-modal');
    modal.style.display = 'none';
}

function applyDiscountSettings() {
    const discountInput = document.getElementById('discount-input');
    
    const newDiscount = parseFloat(discountInput.value) || 0;
    
    // Validate input
    if (newDiscount < 0 || newDiscount > 100) {
        // Removed alert
        return;
    }
    
    discountPercent = newDiscount;
    
    saveTaxSettings();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();
    closeDiscountModal();
}

// --- GST Modal Functions ---
function openGSTModal() {
    const modal = document.getElementById('gst-modal');
    const gstInput = document.getElementById('gst-input');
    const gstinInput = document.getElementById('gstin-input');
    
    // Set current values
    gstInput.value = gstPercent;
    gstinInput.value = document.getElementById('custGSTIN').value || '';
    
    modal.style.display = 'block';
}

function closeGSTModal() {
    const modal = document.getElementById('gst-modal');
    modal.style.display = 'none';
}

function applyGSTSettings() {
    const gstInput = document.getElementById('gst-input');
    const gstinInput = document.getElementById('gstin-input');
    
    const newGST = parseFloat(gstInput.value) || 0;
    const newGSTIN = gstinInput.value.trim();
    
    // Validate input
    if (newGST < 0 || newGST > 100) {
        // Removed alert
        return;
    }
    
    gstPercent = newGST;
    
    // Update GSTIN in customer details
    document.getElementById('custGSTIN').value = newGSTIN;
    
    saveTaxSettings();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();
    closeGSTModal();
}

function saveGSTIN() {
    saveToLocalStorage();
    saveStateToHistory();
}

function saveTaxSettings() {
    const taxSettings = {
        discountPercent: discountPercent,
        gstPercent: gstPercent
    };
    localStorage.setItem('taxSettings', JSON.stringify(taxSettings));
}

function loadTaxSettings() {
    const saved = localStorage.getItem('taxSettings');
    if (saved) {
        const taxSettings = JSON.parse(saved);
        discountPercent = taxSettings.discountPercent || 0;
        gstPercent = taxSettings.gstPercent || 0;
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const discountModal = document.getElementById('discount-modal');
    const gstModal = document.getElementById('gst-modal');
    
    if (event.target == discountModal) {
        closeDiscountModal();
    }
    if (event.target == gstModal) {
        closeGSTModal();
    }
}

// --- Drag and Drop Functions ---

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (dragSrcEl !== this) {
        const tbody = this.parentNode;
        const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));
        const srcIndex = rows.indexOf(dragSrcEl);
        const destIndex = rows.indexOf(this);
        
        if (srcIndex < destIndex) {
            tbody.insertBefore(dragSrcEl, this.nextSibling);
        } else {
            tbody.insertBefore(dragSrcEl, this);
        }
        
        updateSerialNumbers();
        updateTotal();
        saveToLocalStorage();
        saveStateToHistory();
    }
    
    this.classList.remove('drag-over');
    return false;
}

function handleDragEnd(e) {
    document.querySelectorAll('tr[data-id]').forEach(row => {
        row.classList.remove('dragging', 'drag-over');
    });
}

function addDragAndDropListeners(row) {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragenter', handleDragEnter);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);
}

// --- View Toggling ---

function toggleView() {
    const bill = document.getElementById("bill-container");
    const area = document.getElementById("area-item-container");
    const manual = document.getElementById("manual-item-container");
    const viewText = document.getElementById('view-text');
    const viewIcon = document.getElementById('view-icon');
    
    // Toggle the view state
    currentView = currentView === 'input' ? 'bill' : 'input';

    if (currentView === 'bill') {
        // Switch to Bill view (hide input container, show bill container)
        bill.style.display = "block";
        area.style.display = "none";
        manual.style.display = "none";
        // Update button text to "SHOW INPUT"
        viewText.textContent = "SHOW INPUT";
        viewIcon.textContent = "edit"; 
        
        // Hide drag columns in bill view
        hideTableColumn(document.getElementById("copyListArea"), 7, "none");
        hideTableColumn(document.getElementById("copyListManual"), 7, "none");
    } else {
        // Switch to Input view (show active input container, hide bill container)
        bill.style.display = "none";
        if (currentMode === 'area') {
            area.style.display = "block";
            manual.style.display = "none";
        } else {
            area.style.display = "none";
            manual.style.display = "block";
        }
        // Update button text to "SHOW BILL"
        viewText.textContent = "SHOW BILL";
        viewIcon.textContent = "description";
        
        // Show drag columns in input view
        hideTableColumn(document.getElementById("copyListArea"), 7, "table-cell");
        hideTableColumn(document.getElementById("copyListManual"), 7, "table-cell");
    }
}

// --- Mode Switching ---

function loadSavedMode() {
    const savedMode = localStorage.getItem('currentMode') || 'area';
    currentMode = savedMode;
    // Set the body's data attribute for CSS/JS checks
    document.body.setAttribute('data-mode', currentMode);
    
    // Update the UI immediately without saving to history
    updateModeUI(false);
}

function toggleMode() {
    // 1. Save current state before switching
    saveToLocalStorage();
    saveStateToHistory();
    
    // 2. Switch mode
    currentMode = currentMode === 'area' ? 'manual' : 'area';
    localStorage.setItem('currentMode', currentMode);
    document.body.setAttribute('data-mode', currentMode);

    // 3. Load new mode's state
    loadFromLocalStorage();
    loadHistoryFromLocalStorage(); // Switch history sidebar content
    
    // 4. Update UI elements (prevents the 'alert' from the previous version)
    updateModeUI(false); 
}

function updateModeUI(showSwitchAlert) {
    const isArea = currentMode === 'area';
    const areaContainer = document.getElementById('area-item-container');
    const manualContainer = document.getElementById('manual-item-container');
    const billContainer = document.getElementById('bill-container');
    const copyListArea = document.getElementById('copyListArea');
    const copyListManual = document.getElementById('copyListManual');
    const modeIcon = document.getElementById('mode-icon');
    const modeText = document.getElementById('mode-text');

    // Toggle item container visibility based on current mode AND current view
    if (currentView === 'input') {
        areaContainer.style.display = isArea ? 'block' : 'none';
        manualContainer.style.display = isArea ? 'none' : 'block';
        billContainer.style.display = 'none';
        
        // Show drag columns in input view
        hideTableColumn(copyListArea, 7, "table-cell");
        hideTableColumn(copyListManual, 7, "table-cell");
    } else {
        // If view is 'bill', show bill container and hide all others
        areaContainer.style.display = 'none';
        manualContainer.style.display = 'none';
        billContainer.style.display = 'block';
        
        // Hide drag columns in bill view
        hideTableColumn(copyListArea, 7, "none");
        hideTableColumn(copyListManual, 7, "none");
    }

    // Toggle bill table visibility
    copyListArea.style.display = isArea ? 'table' : 'none';
    copyListManual.style.display = isArea ? 'none' : 'table';
    
    // Update Mode Button
    modeIcon.textContent = isArea ? 'calculate' : 'tune';
    modeText.textContent = isArea ? 'AREA MODE' : 'MANUAL MODE';

    // Update total amount display
    updateTotal();
    
    // Removed all alert/confirmation logic
}

function toggleHistorySidebar() {
    const sidebar = document.getElementById("history-sidebar");
    const overlay = document.getElementById("history-overlay");
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
    if (sidebar.classList.contains("open")) {
        loadHistoryFromLocalStorage(); // Refresh history content when opening
    }
}

// --- Area Bill Mode Functions ---

function addRowArea() {
    let width = parseFloat(document.getElementById("width").value.trim());
    let height = parseFloat(document.getElementById("height").value.trim());
    let depth = parseFloat(document.getElementById("depth").value.trim());
    let rate = parseFloat(document.getElementById("rate").value.trim());
    let quantity = parseInt(document.getElementById("quantity").value.trim());
    let itemName = document.getElementById("itemName").value.trim();
    let measurement = document.getElementById("selectMeasurement").value.trim();
    const notes = document.getElementById("itemNotesArea").value.trim();

    if (isNaN(width) || isNaN(height) || isNaN(rate) || isNaN(quantity) || !itemName) {
        // Removed alert
        return;
    }

    let area = convertToFeet(width, measurement) * convertToFeet(height, measurement);
    let amount = (Number(area) * Number(rate)) * Number(quantity);
    const id = 'row-area-' + rowCounterArea++;

    const row1 = createTableRowArea(id, itemName, width, height, depth, measurement, notes, area, rate, quantity, amount, true);
    const row2 = createTableRowArea(id, itemName, width, height, depth, measurement, notes, area, rate, quantity, amount, false);

    document.getElementById("createListArea").querySelector('tbody').appendChild(row1);
    document.getElementById("copyListArea").querySelector('tbody').appendChild(row2);

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();

    // Clear input fields
    ["width", "height", "depth", "rate", "quantity", "itemName", "itemNotesArea"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    document.getElementById("width").focus();
}

function updateRowArea() {
    if (!currentlyEditingRowIdArea) return;

    let width = parseFloat(document.getElementById("width").value.trim());
    let height = parseFloat(document.getElementById("height").value.trim());
    let depth = parseFloat(document.getElementById("depth").value.trim());
    let rate = parseFloat(document.getElementById("rate").value.trim());
    let quantity = parseInt(document.getElementById("quantity").value.trim());
    let itemName = document.getElementById("itemName").value.trim();
    let measurement = document.getElementById("selectMeasurement").value.trim();
    const notes = document.getElementById("itemNotesArea").value.trim();

    if (isNaN(width) || isNaN(height) || isNaN(rate) || isNaN(quantity) || !itemName) {
        // Removed alert
        return;
    }

    let area = convertToFeet(width, measurement) * convertToFeet(height, measurement);
    let amount = (Number(area) * Number(rate)) * Number(quantity);

    let particularsHtml = formatParticularsArea(itemName, width, height, depth, measurement, notes);

    const rows = document.querySelectorAll(`tr[data-id="${currentlyEditingRowIdArea}"]`);
    rows.forEach(row => {
        const cells = row.children;
        cells[1].innerHTML = particularsHtml;
        cells[2].innerHTML = `${area.toFixed(2)} ft<sup>2</sup>`;
        cells[3].textContent = rate.toFixed(2);
        cells[4].textContent = quantity;
        cells[5].textContent = amount.toFixed(2);
    });

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();

    // Reset form
    ["width", "height", "depth", "rate", "quantity", "itemName", "itemNotesArea"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    document.getElementById("addItemBtnArea").style.display = "inline-block";
    document.getElementById("updateItemBtnArea").style.display = "none";
    currentlyEditingRowIdArea = null;
    document.getElementById("width").focus();
}

function editRowArea(id) {
    if (currentMode !== 'area') return;
    const row = document.querySelector(`#createListArea tr[data-id="${id}"]`);
    if (!row) return;

    currentlyEditingRowIdArea = id;
    const cells = row.children;
    const particularsDiv = cells[1];
    const itemName = particularsDiv.querySelector('.itemNameClass')?.textContent.trim() || '';
    const sizesText = particularsDiv.querySelector('.sizes')?.textContent || '';
    const notesText = particularsDiv.querySelector('.notes')?.textContent || '';

    const dimensionsMatch = sizesText.match(/W ([\d.]+)([a-z]+)(?: x H ([\d.]+)([a-z]+))?(?: x D ([\d.]+)([a-z]+))?/);

    if (dimensionsMatch) {
        document.getElementById("width").value = dimensionsMatch[1] || '';
        document.getElementById("height").value = dimensionsMatch[3] || '';
        document.getElementById("depth").value = dimensionsMatch[5] || '';
        document.getElementById("selectMeasurement").value = dimensionsMatch[2] || 'ft';
    } else {
        document.getElementById("width").value = "";
        document.getElementById("height").value = "";
        document.getElementById("depth").value = "";
        document.getElementById("selectMeasurement").value = "ft";
    }

    document.getElementById("rate").value = cells[3].textContent;
    document.getElementById("quantity").value = cells[4].textContent;
    document.getElementById("itemName").value = itemName;
    document.getElementById("itemNotesArea").value = notesText;

    document.getElementById("addItemBtnArea").style.display = "none";
    document.getElementById("updateItemBtnArea").style.display = "inline-block";
    
    // Ensure manual mode fields are cleared/hidden if they were open
    ["itemNameManual", "quantityManual", "rateManual", "itemNotesManual"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    document.getElementById("addItemBtnManual").style.display = "inline-block";
    document.getElementById("updateItemBtnManual").style.display = "none";
}

function formatParticularsArea(itemName, width, height, depth, measurement, notes) {
    let particularsHtml = `<div class="itemNameClass">${itemName}</div>`;
    let dimensionsParts = [];
    if (width) dimensionsParts.push(`W ${width}${measurement}`);
    if (height) dimensionsParts.push(`H ${height}${measurement}`);
    if (depth) dimensionsParts.push(`D ${depth}${measurement}`);

    if (dimensionsParts.length > 0) {
        particularsHtml += `<p class="sizes"> ${dimensionsParts.join(' x ')} </p>`;
    }
    if (notes) {
        particularsHtml += `<p class="notes">${notes}</p>`;
    }
    return particularsHtml;
}

function createTableRowArea(id, itemName, width, height, depth, measurement, notes, area, rate, quantity, amount, editable) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", id);
    if (editable) {
        tr.addEventListener('click', () => editRowArea(id));
        addDragAndDropListeners(tr);
    }

    let particularsHtml = formatParticularsArea(itemName, width, height, depth, measurement, notes);

    const removeFn = editable ? `removeRowArea('${id}')` : `removeRowArea('${id}', true)`;
    
    tr.innerHTML = `
        <td class="sr-no"></td>
        <td>${particularsHtml}</td>
        <td>${area.toFixed(2)} ft<sup>2</sup></td>
        <td>${rate.toFixed(2)}</td>
        <td>${quantity}</td>
        <td class="amount">${amount.toFixed(2)}</td>
        <td><button onclick="${removeFn}" class="remove-btn"><span class="material-icons">close</span></button></td>
        <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
    `;
    return tr;
}


// --- Manual Bill Mode Functions (NEW) ---

function addRowManual() {
    let itemName = document.getElementById("itemNameManual").value.trim();
    let quantity = parseFloat(document.getElementById("quantityManual").value.trim());
    let unit = document.getElementById("selectUnit").value.trim();
    let rate = parseFloat(document.getElementById("rateManual").value.trim());
    const notes = document.getElementById("itemNotesManual").value.trim();

    if (isNaN(quantity) || isNaN(rate) || !itemName) {
        // Removed alert
        return;
    }

    let amount = Number(quantity) * Number(rate);
    const id = 'row-manual-' + rowCounterManual++;

    const row1 = createTableRowManual(id, itemName, quantity, unit, rate, amount, notes, true);
    const row2 = createTableRowManual(id, itemName, quantity, unit, rate, amount, notes, false);

    document.getElementById("createListManual").querySelector('tbody').appendChild(row1);
    document.getElementById("copyListManual").querySelector('tbody').appendChild(row2);

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();

    // Clear input fields
    ["itemNameManual", "quantityManual", "rateManual", "itemNotesManual"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    document.getElementById("itemNameManual").focus();
}

function updateRowManual() {
    if (!currentlyEditingRowIdManual) return;

    let itemName = document.getElementById("itemNameManual").value.trim();
    let quantity = parseFloat(document.getElementById("quantityManual").value.trim());
    let unit = document.getElementById("selectUnit").value.trim();
    let rate = parseFloat(document.getElementById("rateManual").value.trim());
    const notes = document.getElementById("itemNotesManual").value.trim();

    if (isNaN(quantity) || isNaN(rate) || !itemName) {
        // Removed alert
        return;
    }

    let amount = Number(quantity) * Number(rate);

    let particularsHtml = formatParticularsManual(itemName, notes);

    const rows = document.querySelectorAll(`tr[data-id="${currentlyEditingRowIdManual}"]`);
    rows.forEach(row => {
        const cells = row.children;
        cells[1].innerHTML = particularsHtml;
        cells[2].textContent = quantity;
        cells[3].textContent = unit;
        cells[4].textContent = rate.toFixed(2);
        cells[5].textContent = amount.toFixed(2);
    });

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();

    // Reset form
    ["itemNameManual", "quantityManual", "rateManual", "itemNotesManual"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    document.getElementById("addItemBtnManual").style.display = "inline-block";
    document.getElementById("updateItemBtnManual").style.display = "none";
    currentlyEditingRowIdManual = null;
    document.getElementById("itemNameManual").focus();
}

function editRowManual(id) {
    if (currentMode !== 'manual') return;
    const row = document.querySelector(`#createListManual tr[data-id="${id}"]`);
    if (!row) return;

    currentlyEditingRowIdManual = id;
    const cells = row.children;
    const particularsDiv = cells[1];
    const itemName = particularsDiv.querySelector('.itemNameClass')?.textContent.trim() || '';
    const notesText = particularsDiv.querySelector('.notes')?.textContent || '';

    document.getElementById("itemNameManual").value = itemName;
    document.getElementById("quantityManual").value = cells[2].textContent;
    document.getElementById("selectUnit").value = cells[3].textContent;
    document.getElementById("rateManual").value = cells[4].textContent;
    document.getElementById("itemNotesManual").value = notesText;

    document.getElementById("addItemBtnManual").style.display = "none";
    document.getElementById("updateItemBtnManual").style.display = "inline-block";
    
    // Ensure area mode fields are cleared/hidden if they were open
    ["width", "height", "depth", "rate", "quantity", "itemName", "itemNotesArea"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    document.getElementById("addItemBtnArea").style.display = "inline-block";
    document.getElementById("updateItemBtnArea").style.display = "none";
}

function formatParticularsManual(itemName, notes) {
    let particularsHtml = `<div class="itemNameClass">${itemName}</div>`;
    if (notes) {
        particularsHtml += `<p class="notes">${notes}</p>`;
    }
    return particularsHtml;
}

function createTableRowManual(id, itemName, quantity, unit, rate, amount, notes, editable) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", id);
    if (editable) {
        tr.addEventListener('click', () => editRowManual(id));
        addDragAndDropListeners(tr);
    }

    let particularsHtml = formatParticularsManual(itemName, notes);
    
    const removeFn = editable ? `removeRowManual('${id}')` : `removeRowManual('${id}', true)`;

    tr.innerHTML = `
        <td class="sr-no"></td>
        <td>${particularsHtml}</td>
        <td>${quantity}</td>
        <td>${unit}</td>
        <td>${rate.toFixed(2)}</td>
        <td class="amount">${amount.toFixed(2)}</td>
        <td><button onclick="${removeFn}" class="remove-btn"><span class="material-icons">close</span></button></td>
        <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
    `;
    return tr;
}


// --- General Functions (Mode-Aware) ---

function removeRowArea(id) {
    document.querySelectorAll(`tr[data-id="${id}"]`).forEach(row => row.remove());
    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();
}

function removeRowManual(id) {
    document.querySelectorAll(`tr[data-id="${id}"]`).forEach(row => row.remove());
    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();
}

function updateSerialNumbers() {
    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;

    [createListId, copyListId].forEach(tableId => {
        const rows = document.querySelectorAll(`#${tableId} tbody tr[data-id]`);
        rows.forEach((row, i) => {
            row.querySelector('.sr-no').textContent = i + 1;
        });
    });
}

function updateTotal() {
    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const totalAmountId = vars.totalAmountId;
    const copyTotalAmountId = vars.copyTotalAmountId;

    const total = Array.from(document.querySelectorAll(`#${createListId} tbody tr[data-id]`))
        .reduce((sum, row) => {
            const amountCell = row.querySelector('.amount');
            if (amountCell) {
                const amountText = amountCell.textContent.trim();
                // Only parse if it's a valid number (not "close" or other text)
                const amountValue = parseFloat(amountText);
                return sum + (isNaN(amountValue) ? 0 : amountValue);
            }
            return sum;
        }, 0);

    // Calculate discount and GST
    const discountAmount = total * (discountPercent / 100);
    const subtotalAfterDiscount = total - discountAmount;
    const gstAmount = subtotalAfterDiscount * (gstPercent / 100);
    const grandTotal = subtotalAfterDiscount + gstAmount;

    // Update the UI for both item container and bill container totals
    document.getElementById(totalAmountId).textContent = total.toFixed(2);
    document.getElementById(copyTotalAmountId).textContent = total.toFixed(2);

    // Update discount display
    const discountRow = document.getElementById('discount-row');
    const discountPercentSpan = document.getElementById('discount-percent');
    const discountAmountTd = document.getElementById('discount-amount');
    
    if (discountPercent > 0) {
        discountRow.style.display = '';
        discountPercentSpan.textContent = discountPercent;
        discountAmountTd.textContent = `-${discountAmount.toFixed(2)}`;
    } else {
        discountRow.style.display = 'none';
    }

    // Update GST display
    const gstRow = document.getElementById('gst-row');
    const gstPercentSpan = document.getElementById('gst-percent');
    const gstAmountTd = document.getElementById('gst-amount');
    const grandTotalRow = document.getElementById('grand-total-row');
    const grandTotalAmount = document.getElementById('grand-total-amount');
    
    if (gstPercent > 0) {
        gstRow.style.display = '';
        gstPercentSpan.textContent = gstPercent;
        gstAmountTd.textContent = `+${gstAmount.toFixed(2)}`;
        grandTotalRow.style.display = '';
        grandTotalAmount.textContent = grandTotal.toFixed(2);
    } else {
        gstRow.style.display = 'none';
        grandTotalRow.style.display = 'none';
    }
    
    // If only discount is applied, show grand total
    if (discountPercent > 0 && gstPercent === 0) {
        grandTotalRow.style.display = '';
        grandTotalAmount.textContent = subtotalAfterDiscount.toFixed(2);
    }
}

function saveToLocalStorage() {
    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const localStorageKey = vars.localStorageKey;
    
    const data = {
        items: [],
        company: {
            name: document.getElementById("companyName").textContent,
            address: document.getElementById("companyAddr").textContent,
            phone: document.getElementById("companyPhone").textContent
        },
        customer: {
            name: document.getElementById("custName").value,
            billNo: document.getElementById("billNo").value,
            address: document.getElementById("custAddr").value,
            date: document.getElementById("billDate").value,
            phone: document.getElementById("custPhone").value,
            gstin: document.getElementById("custGSTIN").value
        },
        // Add tax settings to saved data
        taxSettings: {
            discountPercent: discountPercent,
            gstPercent: gstPercent
        }
    };

    document.querySelectorAll(`#${createListId} tbody tr[data-id]`).forEach(row => {
        const cells = row.children;
        const item = {
            id: row.dataset.id,
            particulars: cells[1].innerHTML,
            rate: cells[4].textContent, // This index needs to be flexible for manual mode
            qty: cells[2].textContent, // This index needs to be flexible for manual mode
            amt: cells[5].textContent
        };
        
        // Add mode-specific fields
        if (currentMode === 'area') {
            item.area = cells[2].textContent;
            item.rate = cells[3].textContent;
            item.qty = cells[4].textContent;
        } else {
            item.qty = cells[2].textContent;
            item.unit = cells[3].textContent;
            item.rate = cells[4].textContent;
        }
        
        data.items.push(item);
    });

    localStorage.setItem(localStorageKey, JSON.stringify(data));
}

function loadFromLocalStorage() {
    // Save the previous mode's rowCounter
    const prevMode = currentMode === 'area' ? 'manual' : 'area';
    if (prevMode === 'area') {
        rowCounterArea = getModeSpecificVars().rowCounter;
    } else {
        rowCounterManual = getModeSpecificVars().rowCounter;
    }
    
    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;
    const localStorageKey = vars.localStorageKey;
    const saved = localStorage.getItem(localStorageKey);
    if (!saved) {
        document.getElementById(createListId).querySelector('tbody').innerHTML = '';
        document.getElementById(copyListId).querySelector('tbody').innerHTML = '';
        updateSerialNumbers();
        updateTotal();
        return;
    }

    const data = JSON.parse(saved);

    // Restore common details
    document.getElementById("companyName").textContent = data.company.name;
    document.getElementById("companyAddr").textContent = data.company.address;
    document.getElementById("companyPhone").textContent = data.company.phone;
    document.getElementById("custName").value = data.customer.name;
    document.getElementById("billNo").value = data.customer.billNo;
    document.getElementById("custAddr").value = data.customer.address;
    document.getElementById("billDate").value = data.customer.date;
    document.getElementById("custPhone").value = data.customer.phone;
    document.getElementById("custGSTIN").value = data.customer.gstin || '';

    // Load tax settings if they exist
    if (data.taxSettings) {
        discountPercent = data.taxSettings.discountPercent || 0;
        gstPercent = data.taxSettings.gstPercent || 0;
    }

    let maxId = 0;
    data.items.forEach(row => {
        const idNum = parseInt(row.id.split('-')[2]);
        if (idNum > maxId) maxId = idNum;
    });

    if (currentMode === 'area') {
        rowCounterArea = maxId + 1;
    } else {
        rowCounterManual = maxId + 1;
    }

    document.getElementById(createListId).querySelector('tbody').innerHTML = '';
    document.getElementById(copyListId).querySelector('tbody').innerHTML = '';

    data.items.forEach(row => {
        let row1, row2;
        if (currentMode === 'area') {
            // Reconstruct Area row. Note: Need to pass the original data to reconstruct the row fully
            // Since we don't have the original W, H, D, Measurement, we'll extract them from particulars for now
            // A more robust solution would be to save W, H, D, Measurement separately in saveToLocalStorage
            row1 = document.createElement("tr");
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowArea(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
              <td class="sr-no"></td>
              <td>${row.particulars}</td>
              <td>${parseFloat(row.area).toFixed(2)} ft<sup>2</sup></td>  <!-- Fixed this line -->
              <td>${row.rate}</td>
              <td>${row.qty}</td>
              <td class="amount">${row.amt}</td>
              <td><button onclick="removeRowArea('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
              <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;

            row2 = document.createElement("tr");
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowArea(row.id));
            row2.innerHTML = row1.innerHTML;
        } else { // Manual mode
            row1 = document.createElement("tr");
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowManual(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
              <td class="sr-no"></td>
              <td>${row.particulars}</td>
              <td>${row.qty}</td>
              <td>${row.unit}</td>
              <td>${row.rate}</td>
              <td class="amount">${row.amt}</td>
              <td><button onclick="removeRowManual('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
              <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;

            row2 = document.createElement("tr");
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowManual(row.id));
            row2.innerHTML = row1.innerHTML;
        }


        document.getElementById(createListId).querySelector('tbody').appendChild(row1);
        document.getElementById(copyListId).querySelector('tbody').appendChild(row2);
    });

    updateSerialNumbers();
    updateTotal();
}

function clearAllData() {
    // REMOVED CONFIRMATION: The function now executes without confirmation
    
    saveToHistory();

    document.getElementById("custName").value = "";
    document.getElementById("billNo").value = "";
    document.getElementById("custAddr").value = "";
    document.getElementById("billDate").value = "";
    document.getElementById("custPhone").value = "";
    document.getElementById("custGSTIN").value = "";

    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;
    const localStorageKey = vars.localStorageKey;

    document.getElementById(createListId).querySelector('tbody').innerHTML = '';
    document.getElementById(copyListId).querySelector('tbody').innerHTML = '';

    if (currentMode === 'area') {
        rowCounterArea = 1;
    } else {
        rowCounterManual = 1;
    }

    // Reset tax settings when clearing all data
    discountPercent = 0;
    gstPercent = 0;

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory();
}

function downloadPDF() {
    const vars = getModeSpecificVars();
    const copyListId = vars.copyListId;
    const isAreaMode = currentMode === 'area';
    const rateColIndex = isAreaMode ? 3 : 4;
    const areaColIndex = 2;
    const removeColIndex = isAreaMode ? 6 : 6;
    const dragColIndex = isAreaMode ? 7 : 7;
    
    // UI elements
    const billContainer = document.getElementById("bill-container");
    const areaContainer = document.getElementById("area-item-container");
    const manualContainer = document.getElementById("manual-item-container");
    const tools = document.getElementById("tools");
    const historySidebar = document.getElementById("history-sidebar");
    const historyOverlay = document.getElementById("history-overlay");

    // Tax rows that need to be shown in PDF
    const discountRow = document.getElementById('discount-row');
    const gstRow = document.getElementById('gst-row');
    const grandTotalRow = document.getElementById('grand-total-row');
    
    // Store initial display states
    const initialBillDisplay = billContainer.style.display;
    const initialAreaDisplay = areaContainer.style.display;
    const initialManualDisplay = manualContainer.style.display;
    const initialToolsDisplay = tools.style.display;
    const initialHistorySidebarDisplay = historySidebar ? historySidebar.style.display : 'none';
    const initialHistoryOverlayDisplay = historyOverlay ? historyOverlay.style.display : 'none';
    
    // Store initial tax row display states
    const initialDiscountDisplay = discountRow ? discountRow.style.display : 'none';
    const initialGstDisplay = gstRow ? gstRow.style.display : 'none';
    const initialGrandTotalDisplay = grandTotalRow ? grandTotalRow.style.display : 'none';

    // 1. Configure the display for PDF generation
    billContainer.style.display = "block";
    areaContainer.style.display = "none";
    manualContainer.style.display = "none";
    if(historySidebar) historySidebar.style.display = "none";
    if(historyOverlay) historyOverlay.style.display = "none";
    if(tools) tools.style.display = "none";

    // 2. Ensure tax rows are visible for PDF
    if(discountRow && discountPercent > 0) discountRow.style.display = '';
    if(gstRow && gstPercent > 0) gstRow.style.display = '';
    if(grandTotalRow && (discountPercent > 0 || gstPercent > 0)) grandTotalRow.style.display = '';

    // 3. Ensure only the current mode's table is visible in the bill container
    const copyListArea = document.getElementById("copyListArea");
    const copyListManual = document.getElementById("copyListManual");
    copyListArea.style.display = isAreaMode ? "table" : "none";
    copyListManual.style.display = isAreaMode ? "none" : "table";

    // 4. Hide "Remove" and "Drag" columns in the displayed bill table (copyList)
    hideTableColumn(document.getElementById(copyListId), removeColIndex, "none");
    hideTableColumn(document.getElementById(copyListId), dragColIndex, "none");
    
    // 5. Hide Rate column if it was toggled off
    if (rateColumnHidden) {
        hideTableColumn(document.getElementById(copyListId), rateColIndex, "none");
    }

    // 6. Hide Area column in manual mode
    if (!isAreaMode) {
        hideTableColumn(copyListArea, areaColIndex, "none");
    }

    // Configuration options for html2pdf
    const opt = {
        margin: 0.5,
        filename: `${document.getElementById("custName").value || 'bill'}_${document.getElementById("billNo").value || 'no-num'}.pdf`,
        image: { type: 'jpeg', quality: 100 },
        html2canvas: { scale: 5, useCORS: true, logging: true, allowTaint: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Generate and save the PDF
    html2pdf().set(opt).from(billContainer).save().then(() => {
        // Use setTimeout to revert display states after PDF generation is complete
        setTimeout(() => {
            // Restore initial display states
            billContainer.style.display = initialBillDisplay;
            areaContainer.style.display = initialAreaDisplay;
            manualContainer.style.display = initialManualDisplay;
            if(tools) tools.style.display = initialToolsDisplay;
            if(historySidebar) historySidebar.style.display = initialHistorySidebarDisplay;
            if(historyOverlay) historyOverlay.style.display = initialHistoryOverlayDisplay;

            // Restore tax row display states
            if(discountRow) discountRow.style.display = initialDiscountDisplay;
            if(gstRow) gstRow.style.display = initialGstDisplay;
            if(grandTotalRow) grandTotalRow.style.display = initialGrandTotalDisplay;

            // Restore columns
            hideTableColumn(document.getElementById(copyListId), removeColIndex, "table-cell");
            hideTableColumn(document.getElementById(copyListId), dragColIndex, "table-cell");
            
            if (rateColumnHidden) {
                 hideTableColumn(document.getElementById(copyListId), rateColIndex, "table-cell");
            }
            if (!isAreaMode) {
                hideTableColumn(copyListArea, areaColIndex, "table-cell");
            }

            // Restore table visibility
            copyListArea.style.display = currentMode === 'area' ? "table" : "none";
            copyListManual.style.display = currentMode === 'manual' ? "table" : "none";
            
        }, 100);
    });
}

function saveStateToHistory() {
    const vars = getModeSpecificVars();
    const historyStack = vars.historyStack;
    let historyIndex = vars.historyIndex;
    const createListId = vars.createListId;
    
    if (historyIndex < historyStack.length - 1) {
        historyStack.splice(historyIndex + 1);
    }

    const state = {
        items: Array.from(document.querySelectorAll(`#${createListId} tbody tr[data-id]`)).map(row => {
            const cells = row.children;
            const item = {
                id: row.dataset.id,
                particulars: cells[1].innerHTML,
                amt: cells[5].textContent // Fixed: Amount is always at index 5
            };
            if (currentMode === 'area') {
                item.area = cells[2].textContent;
                item.rate = cells[3].textContent;
                item.qty = cells[4].textContent;
            } else { // Manual Mode indices
                item.qty = cells[2].textContent;
                item.unit = cells[3].textContent;
                item.rate = cells[4].textContent;
            }
            return item;
        }),
        company: {
            name: document.getElementById("companyName").textContent,
            address: document.getElementById("companyAddr").textContent,
            phone: document.getElementById("companyPhone").textContent
        },
        customer: {
            name: document.getElementById("custName").value,
            billNo: document.getElementById("billNo").value,
            address: document.getElementById("custAddr").value,
            date: document.getElementById("billDate").value,
            phone: document.getElementById("custPhone").value,
            gstin: document.getElementById("custGSTIN").value
        },
        // Add tax settings to history state
        taxSettings: {
            discountPercent: discountPercent,
            gstPercent: gstPercent
        }
    };

    historyStack.push(JSON.stringify(state));
    historyIndex = historyStack.length - 1;

    // Update the mode-specific variables in the global scope
    if (currentMode === 'area') {
        historyStackArea = historyStack;
        historyIndexArea = historyIndex;
    } else {
        historyStackManual = historyStack;
        historyIndexManual = historyIndex;
    }
}

function restoreStateFromHistory() {
    const vars = getModeSpecificVars();
    const historyStack = vars.historyStack;
    let historyIndex = vars.historyIndex;
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;

    if (historyIndex < 0 || historyIndex >= historyStack.length) return;

    const state = JSON.parse(historyStack[historyIndex]);

    // Restore tax settings
    if (state.taxSettings) {
        discountPercent = state.taxSettings.discountPercent || 0;
        gstPercent = state.taxSettings.gstPercent || 0;
    }

    // Restore common info
    document.getElementById("companyName").textContent = state.company.name;
    document.getElementById("companyAddr").textContent = state.company.address;
    document.getElementById("companyPhone").textContent = state.company.phone;
    document.getElementById("custName").value = state.customer.name;
    document.getElementById("billNo").value = state.customer.billNo;
    document.getElementById("custAddr").value = state.customer.address;
    document.getElementById("billDate").value = state.customer.date;
    document.getElementById("custPhone").value = state.customer.phone;
    document.getElementById("custGSTIN").value = state.customer.gstin || '';

    document.getElementById(createListId).querySelector('tbody').innerHTML = '';
    document.getElementById(copyListId).querySelector('tbody').innerHTML = '';

    let maxId = 0;
    state.items.forEach(row => {
        const idNum = parseInt(row.id.split('-')[2]);
        if (idNum > maxId) maxId = idNum;
    });

    if (currentMode === 'area') {
        rowCounterArea = maxId + 1;
    } else {
        rowCounterManual = maxId + 1;
    }

    state.items.forEach(row => {
        let row1 = document.createElement("tr");
        let row2 = document.createElement("tr");

        if (currentMode === 'area') {
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowArea(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
                <td class="sr-no"></td>
                <td>${row.particulars}</td>
                <td>${parseFloat(row.area).toFixed(2)} ft<sup>2</sup></td>  <!-- Fixed this line -->
                <td>${row.rate}</td>
                <td>${row.qty}</td>
                <td class="amount">${row.amt}</td>
                <td><button onclick="removeRowArea('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
                <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowArea(row.id));
            row2.innerHTML = row1.innerHTML; // Copy HTML for mirror table
        } else {
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowManual(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
                <td class="sr-no"></td>
                <td>${row.particulars}</td>
                <td>${row.qty}</td>
                <td>${row.unit}</td>
                <td>${row.rate}</td>
                <td class="amount">${row.amt}</td>
                <td><button onclick="removeRowManual('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
                <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowManual(row.id));
            row2.innerHTML = row1.innerHTML; // Copy HTML for mirror table
        }

        document.getElementById(createListId).querySelector('tbody').appendChild(row1);
        document.getElementById(copyListId).querySelector('tbody').appendChild(row2);
    });

    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
}

function undoAction() {
    const vars = getModeSpecificVars();
    const historyStack = vars.historyStack;
    let historyIndex = vars.historyIndex;

    if (historyIndex > 0) {
        historyIndex--;
        if (currentMode === 'area') {
            historyIndexArea = historyIndex;
        } else {
            historyIndexManual = historyIndex;
        }
        restoreStateFromHistory();
    }
}

function redoAction() {
    const vars = getModeSpecificVars();
    const historyStack = vars.historyStack;
    let historyIndex = vars.historyIndex;

    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        if (currentMode === 'area') {
            historyIndexArea = historyIndex;
        } else {
            historyIndexManual = historyIndex;
        }
        restoreStateFromHistory();
    }
}

function saveToHistory() {
    // This saves the current bill to the persistent history sidebar
    const vars = getModeSpecificVars();
    const historyStorageKey = vars.historyStorageKey;
    
    const customerName = document.getElementById("custName").value.trim() || "Unnamed Bill";
    const billNo = document.getElementById("billNo").value.trim() || "No Bill Number";
    const date = document.getElementById("billDate").value.trim() || new Date().toLocaleDateString();

    const historyData = {
        id: Date.now().toString(),
        mode: currentMode,
        title: `${customerName} - ${billNo} (${currentMode.toUpperCase()})`,
        date: date,
        data: localStorage.getItem(vars.localStorageKey)
    };

    let history = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");

    if (history.length > 0) {
        const latestHistoryData = JSON.parse(history[0].data);
        const currentData = JSON.parse(historyData.data);
        if (JSON.stringify(latestHistoryData) === JSON.stringify(currentData)) {
            return;
        }
    }

    // Add the new item to the start of the array
    history.unshift(historyData);
    localStorage.setItem(historyStorageKey, JSON.stringify(history));

    // If sidebar is open, push the data to the start of the visible list
    if (document.getElementById("history-sidebar").classList.contains("open")) {
        // Use a dedicated function to insert at the top
        addHistoryItemToSidebarAtStart(historyData);
    }
}

function loadHistoryFromLocalStorage() {
    const vars = getModeSpecificVars();
    const historyStorageKey = vars.historyStorageKey;
    const history = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    const historyList = document.getElementById("history-list");

    historyList.innerHTML = "";

    // FIX: Iterate the history array in normal order, and use appendChild in
    // addHistoryItemToSidebar to maintain the correct newest-to-oldest order.
    history.forEach(item => {
        addHistoryItemToSidebar(item);
    });
}

function addHistoryItemToSidebar(item) {
    const historyList = document.getElementById("history-list");
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    historyItem.innerHTML = `
        <div class="history-item-title">${item.title}</div>
        <div class="history-item-date">${item.date}</div>
        <button class="history-item-remove" onclick="removeHistoryItem('${item.id}', event)">×</button>
    `;

    historyItem.addEventListener('click', function(e) {
        if (!e.target.classList.contains('history-item-remove')) {
            loadFromHistory(item);
        }
    });

    // CHANGE: Use appendChild here. Since loadHistoryFromLocalStorage iterates [newest, ..., oldest]
    // this ensures the newest is at the top of the visible list.
    historyList.appendChild(historyItem);
}

function addHistoryItemToSidebarAtStart(item) {
    const historyList = document.getElementById("history-list");
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    historyItem.innerHTML = `
        <div class="history-item-title">${item.title}</div>
        <div class="history-item-date">${item.date}</div>
        <button class="history-item-remove" onclick="removeHistoryItem('${item.id}', event)">×</button>
    `;

    historyItem.addEventListener('click', function(e) {
        if (!e.target.classList.contains('history-item-remove')) {
            loadFromHistory(item);
        }
    });

    // Puts the item at the beginning of the list to show the new item immediately at the top
    historyList.insertBefore(historyItem, historyList.firstChild);
}

function loadFromHistory(item) {
    if (!item.data) return;

    // Load history item's mode
    const historyMode = item.mode || (item.id.includes('area') ? 'area' : 'manual'); // Fallback logic
    if (currentMode !== historyMode) {
        currentMode = historyMode;
        localStorage.setItem('currentMode', currentMode);
        document.body.setAttribute('data-mode', currentMode);
        updateModeUI(false);
    }

    const data = JSON.parse(item.data);
    const vars = getModeSpecificVars();
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;
    
    // Restore common info
    document.getElementById("companyName").textContent = data.company.name;
    document.getElementById("companyAddr").textContent = data.company.address;
    document.getElementById("companyPhone").textContent = data.company.phone;
    document.getElementById("custName").value = data.customer.name;
    document.getElementById("billNo").value = data.customer.billNo;
    document.getElementById("custAddr").value = data.customer.address;
    document.getElementById("billDate").value = data.customer.date;
    document.getElementById("custPhone").value = data.customer.phone;
    document.getElementById("custGSTIN").value = data.customer.gstin || '';

    // Restore tax settings
    if (data.taxSettings) {
        discountPercent = data.taxSettings.discountPercent || 0;
        gstPercent = data.taxSettings.gstPercent || 0;
    }

    document.getElementById(createListId).querySelector('tbody').innerHTML = '';
    document.getElementById(copyListId).querySelector('tbody').innerHTML = '';

    let maxId = 0;
    data.items.forEach(row => {
        const idNum = parseInt(row.id.split('-')[2]);
        if (idNum > maxId) maxId = idNum;
    });

    if (currentMode === 'area') {
        rowCounterArea = maxId + 1;
    } else {
        rowCounterManual = maxId + 1;
    }
    
    data.items.forEach(row => {
        let row1, row2;
        if (currentMode === 'area') {
            row1 = document.createElement("tr");
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowArea(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
              <td class="sr-no"></td>
              <td>${row.particulars}</td>
              <td>${parseFloat(row.area).toFixed(2)} ft<sup>2</sup></td>  <!-- Fixed this line -->
              <td>${row.rate}</td>
              <td>${row.qty}</td>
              <td class="amount">${row.amt}</td>
              <td><button onclick="removeRowArea('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
              <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;
            row2 = document.createElement("tr");
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowArea(row.id));
            row2.innerHTML = row1.innerHTML;
        } else {
            row1 = document.createElement("tr");
            row1.setAttribute("data-id", row.id);
            row1.addEventListener('click', () => editRowManual(row.id));
            addDragAndDropListeners(row1);
            row1.innerHTML = `
              <td class="sr-no"></td>
              <td>${row.particulars}</td>
              <td>${row.qty}</td>
              <td>${row.unit}</td>
              <td>${row.rate}</td>
              <td class="amount">${row.amt}</td>
              <td><button onclick="removeRowManual('${row.id}')" class="remove-btn"><span class="material-icons">close</span></button></td>
              <td><button class="drag-handle"><i class="fas fa-grip-lines"></i></button></td>
            `;
            row2 = document.createElement("tr");
            row2.setAttribute("data-id", row.id);
            row2.addEventListener('click', () => editRowManual(row.id));
            row2.innerHTML = row1.innerHTML;
        }
        
        document.getElementById(createListId).querySelector('tbody').appendChild(row1);
        document.getElementById(copyListId).querySelector('tbody').appendChild(row2);
    });


    updateSerialNumbers();
    updateTotal();
    saveToLocalStorage();
    saveStateToHistory(); // Save this loaded state to the undo/redo stack
    toggleHistorySidebar();
}

function removeHistoryItem(id, event) {
    event.stopPropagation();
    
    // Check both mode histories
    ['billHistoryArea', 'billHistoryManual'].forEach(key => {
        let history = JSON.parse(localStorage.getItem(key) || "[]");
        history = history.filter(item => item.id !== id);
        localStorage.setItem(key, JSON.stringify(history));
    });


    const historyItems = document.querySelectorAll('.history-item');
    historyItems.forEach(item => {
        if (item.querySelector('.history-item-remove').getAttribute('onclick').includes(id)) {
            item.remove();
        }
    });
}

function convertToFeet(value, unit) {
    switch (unit.toLowerCase()) {
        case 'ft':
            return value;
        case 'inch':
            return value / 12;
        case 'cm':
            return value / 30.48;
        case 'mm':
            return value / 304.8;
        default:
            return 0; // Return 0 for invalid units in calculation
    }
}

function hideTableColumn(table, columnIndex, display) {
    if (!table || !table.rows) return;
    for (let i = 0; i < table.rows.length; i++) {
        const row = table.rows[i];
        if (row.cells.length > columnIndex) {
            row.cells[columnIndex].style.display = display;
        }
    }
}

function removeOuterQuotes(str) {
    return str ? str.replace(/^["'](.*)["']$/, '$1') : '';
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    changeTheme(themes[currentThemeIndex]);
}

function changeTheme(theme) {
    const root = document.documentElement;

    switch(theme) {
        case 'blue':
            root.style.setProperty('--primary-color', '#3498db');
            root.style.setProperty('--secondary-color', '#2980b9');
            root.style.setProperty('--text-color', '#333');
            root.style.setProperty('--bg-color', '#f9f9f9');
            root.style.setProperty('--border-color', '#ddd');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#ecf0f1');
            break;
        case 'green':
            root.style.setProperty('--primary-color', '#2ecc71');
            root.style.setProperty('--secondary-color', '#27ae60');
            root.style.setProperty('--text-color', '#333');
            root.style.setProperty('--bg-color', '#f9f9f9');
            root.style.setProperty('--border-color', '#ddd');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#eafaf1');
            break;
        case 'red':
            root.style.setProperty('--primary-color', '#e74c3c');
            root.style.setProperty('--secondary-color', '#c0392b');
            root.style.setProperty('--text-color', '#333');
            root.style.setProperty('--bg-color', '#f9f9f9');
            root.style.setProperty('--border-color', '#ddd');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#fdedec');
            break;
        case 'purple':
            root.style.setProperty('--primary-color', '#9b59b6');
            root.style.setProperty('--secondary-color', '#8e44ad');
            root.style.setProperty('--text-color', '#333');
            root.style.setProperty('--bg-color', '#f9f9f9');
            root.style.setProperty('--border-color', '#ddd');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#f5eef8');
            break;
        case 'orange':
            root.style.setProperty('--primary-color', '#f26d38');
            root.style.setProperty('--secondary-color', '#e67e22');
            root.style.setProperty('--text-color', '#333');
            root.style.setProperty('--bg-color', '#f9f9f9');
            root.style.setProperty('--border-color', '#ddd');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#fef5e7');
            break;
        case 'dark':
            root.style.setProperty('--primary-color', '#34495e');
            root.style.setProperty('--secondary-color', '#2c3e50');
            root.style.setProperty('--text-color', '#000');
            root.style.setProperty('--bg-color', '#fff');
            root.style.setProperty('--border-color', '#34495e');
            root.style.setProperty('--highlight-color', '#f1c40f');
            root.style.setProperty('--total-bg', '#e1e1e1');
            break;
    }
    localStorage.setItem('selectedTheme', theme);
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme && themes.includes(savedTheme)) {
        currentThemeIndex = themes.indexOf(savedTheme);
        changeTheme(savedTheme);
    } else {
        changeTheme(themes[0]);
    }
}

function autoSave() {
    saveToLocalStorage();
    saveStateToHistory();
}

function toggleRateColumn() {
    const vars = getModeSpecificVars();
    const isAreaMode = currentMode === 'area';
    const createListId = vars.createListId;
    const copyListId = vars.copyListId;
    const rateColumnIndex = isAreaMode ? 3 : 4;

    const toggleButton = document.querySelector('button[onclick="toggleRateColumn()"]');
    const icon = toggleButton.querySelector('.material-icons');

    if (rateColumnHidden) {
        hideTableColumn(document.getElementById(createListId), rateColumnIndex, "table-cell");
        hideTableColumn(document.getElementById(copyListId), rateColumnIndex, "table-cell");
        icon.textContent = "visibility_off";
        toggleButton.innerHTML = `<span class="material-icons">visibility_off</span>RATE`;
    } else {
        hideTableColumn(document.getElementById(createListId), rateColumnIndex, "none");
        hideTableColumn(document.getElementById(copyListId), rateColumnIndex, "none");
        icon.textContent = "currency_rupee";
        toggleButton.innerHTML = `<span class="material-icons">currency_rupee</span>RATE`;
    }
    rateColumnHidden = !rateColumnHidden;
}
