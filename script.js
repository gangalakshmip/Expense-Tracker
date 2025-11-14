// --- DOM Elements (Modified to target Datalist) ---
const balanceDisplay = document.getElementById('balance');
const incomeDisplay = document.getElementById('total-income');
const expenseDisplay = document.getElementById('total-expense');
const list = document.getElementById('list');
const form = document.getElementById('transaction-form');
const textInput = document.getElementById('text');
const dateInput = document.getElementById('date'); 
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category'); // Text input (datalist target)
const categoryList = document.getElementById('category-list'); 
const balanceChartCanvas = document.getElementById('balance-chart');
// NEW: Reference to the Datalist element from index.html
const categoryDatalist = document.getElementById('category-options');


// Tab Navigation (Unchanged)
const tabButtons = document.querySelectorAll('.tab-btn');
const pageContents = document.querySelectorAll('.page-content');

// LocalStorage & State (Unchanged)
const localStorageTransactions = JSON.parse(localStorage.getItem('transactions'));
let transactions = localStorageTransactions !== null ? localStorageTransactions : [];
let balanceChart; // Chart instance for Income vs Expense

// --- PERSISTENCE LOGIC START ---

// Function to save the current category selection
function saveLastCategory(categoryValue) {
    localStorage.setItem('lastCategory', categoryValue);
}

// Function to load and set the last category selection
function loadLastCategory() {
    const lastCategory = localStorage.getItem('lastCategory');
    if (lastCategory) {
        // Set the value directly to the text input
        categoryInput.value = lastCategory;
    }
}
// --- PERSISTENCE LOGIC END ---


// --- Tab Switching Logic (Unchanged) ---
function switchPage(targetId) {
    pageContents.forEach(page => page.classList.remove('active'));
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(targetId).classList.add('active');
    document.querySelector(`[data-target="${targetId}"]`).classList.add('active');
    
    if(targetId === 'summary-page') {
        updateValues(); 
    } else if (targetId === 'charts-page') {
        const currentIncome = incomeDisplay.innerText.replace('$', '');
        const currentExpense = expenseDisplay.innerText.replace('$', '');
        updateBalanceChart(currentIncome, currentExpense);
    }
}

// Add event listeners (Unchanged)
tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const target = e.target.dataset.target;
        switchPage(target);
    });
});

// Category Input Handler (Simplified for free text)
categoryInput.addEventListener('input', () => { 
    // Save the free text input instantly for persistence
    saveLastCategory(categoryInput.value); 
});

// Amount Input Handler (Simplified)
amountInput.addEventListener('input', () => {
    // Save the last category text (if any)
    saveLastCategory(categoryInput.value); 
});
// --- End Tab Switching Logic ---


// --- DYNAMIC DATALIST POPULATION ---
function populateCategoryDatalist() {
    // 1. Define the core, default options (Income is always mandatory for logic)
    const defaultOptions = ['Income', 'Food', 'Travel', 'Utilities', 'Entertainment', 'Other', 'Uncategorized'];
    
    // 2. Extract unique categories from all transactions
    const uniqueUsedCategories = new Set();
    transactions.forEach(t => {
        // Only consider expense categories (not 'Income') and only unique ones
        if (t.category && t.category !== 'Income') {
            uniqueUsedCategories.add(t.category);
        }
    });

    // 3. Combine default options and used categories, ensuring no duplicates
    const finalCategories = [...new Set([...defaultOptions, ...uniqueUsedCategories])];

    // 4. Clear existing datalist options
    categoryDatalist.innerHTML = '';

    // 5. Add combined options to the datalist
    finalCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoryDatalist.appendChild(option);
    });
}
// --- END DYNAMIC DATALIST POPULATION ---


// --- CRUD & Value Updates ---
function addTransaction(e) {
    e.preventDefault();
    // Validate required fields
    if (textInput.value.trim() === '' || amountInput.value.trim() === '' || dateInput.value.trim() === '') {
        alert('Please complete all fields (Description, Amount, and Date).');
        return;
    }
    
    let amount = +amountInput.value;
    let category = categoryInput.value.trim(); 

    // Determine final category based on amount sign and user input
    if (amount > 0) {
        category = 'Income'; 
    } else if (category === '' || category.toLowerCase() === 'income') {
        // If it's an expense but the field is empty or says 'Income', default it
        category = 'Uncategorized';
    }
    
    const transaction = {
        id: generateID(),
        text: textInput.value,
        date: dateInput.value, 
        amount: amount,
        category: category 
    };

    transactions.push(transaction);
    updateValues();
    updateLocalStorage();
    
    // Crucial: Update the datalist immediately to include the new custom category
    populateCategoryDatalist(); 
    
    // Save the actual category used in this transaction for next time
    saveLastCategory(category); 

    textInput.value = '';
    amountInput.value = '';
    dateInput.value = '';
    
    // When a transaction is added, we re-initialize the list to ensure the new item is sorted correctly
    init();
    switchPage('history-page'); 
}

function generateID() { return Math.floor(Math.random() * 100000000); }
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); 
    if (isNaN(date.getTime())) return dateString; 
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}
function addTransactionDOM(transaction) {
    const sign = transaction.amount < 0 ? '-' : '+';
    const formattedDate = formatDate(transaction.date); 
    const isExpense = transaction.amount < 0;
    const item = document.createElement('li');
    
    item.classList.add(isExpense ? 'minus' : 'plus');
    item.innerHTML = `
        <div class="transaction-details">
            <span class="transaction-text">${transaction.text}</span>
            <span class="transaction-date">${isExpense ? transaction.category + ' | ' : ''}${formattedDate}</span>
        </div>
        <span>${sign}$${Math.abs(transaction.amount).toFixed(2)}</span>
        <button onclick="removeTransaction(${transaction.id})" class="delete-btn">x</button>
    `;
    // FIX 1: Use appendChild to maintain the order established by the sorted loop in init()
    list.appendChild(item); 
}
function updateValues() {
    const amounts = transactions.map(transaction => transaction.amount);
    const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
    balanceDisplay.innerText = `$${total}`;
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0).toFixed(2);
    incomeDisplay.innerText = `$${income}`;
    const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1).toFixed(2);
    expenseDisplay.innerText = `$${expense}`;
    updateCategoryBreakdown();
}
function updateLocalStorage() { localStorage.setItem('transactions', JSON.stringify(transactions)); }
function removeTransaction(id) {
    transactions = transactions.filter(transaction => transaction.id !== id);
    updateLocalStorage();
    init(); 
}
// --- End CRUD & Value Updates ---


// 6. Update Income vs Expense Chart (Unchanged)
function updateBalanceChart(incomeStr, expenseStr) {
    const income = parseFloat(incomeStr);
    const expense = parseFloat(expenseStr);
    const netBalance = income - expense; 

    const labels = ['Financial Overview'];
    
    if (balanceChart) {
        balanceChart.destroy();
    }

    const handleBarClick = (e) => {
        const activeElements = balanceChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);

        if (activeElements.length > 0) {
            const clickedDatasetIndex = activeElements[0].datasetIndex;
            
            balanceChart.data.datasets.forEach(dataset => {
                dataset.hidden = true;
            });
            
            balanceChart.data.datasets[clickedDatasetIndex].hidden = false;

            balanceChart.update();
        }
    };

    if (typeof Chart !== 'undefined' && balanceChartCanvas) {
        balanceChart = new Chart(balanceChartCanvas, {
            type: 'bar', 
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Income',
                        data: [income],
                        backgroundColor: '#4CAF50', 
                        borderColor: 'rgba(255, 255, 255, 0.8)', 
                        borderWidth: 1,
                        borderRadius: 5,
                    },
                    {
                        label: 'Total Expenses',
                        data: [expense], 
                        backgroundColor: '#FF5252',  
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 1,
                        borderRadius: 5,
                    },
                    {
                        label: 'Net Balance',
                        data: [netBalance],
                        backgroundColor: '#2196F3', 
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 1,
                        borderRadius: 5,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: handleBarClick,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: 'white', font: { size: 14, family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                label += `$${context.parsed.y.toFixed(2)}`;
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: false, 
                        ticks: {
                            color: 'white', 
                            callback: function(value) { return '$' + value.toFixed(0); }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    } 
}

// 7. Update Category Breakdown List (Unchanged)
function updateCategoryBreakdown() {
    categoryList.innerHTML = '';
    const expenseTransactions = transactions.filter(t => t.amount < 0);
    const totalExpense = expenseTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);

    if (totalExpense === 0) {
        categoryList.innerHTML = '<li class="empty-state">No expenses recorded yet.</li>';
        return;
    }

    const categoryTotals = expenseTransactions.reduce((acc, t) => {
        const cat = t.category || 'Uncategorized'; 
        acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
        return acc;
    }, {});
    
    const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
    
    sortedCategories.forEach(([category, total]) => {
        const percentage = totalExpense > 0 ? ((total / totalExpense) * 100).toFixed(1) : 0;
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span class="category-name">${category}</span>
            <span>$${total.toFixed(2)}</span>
            <span class="category-percentage">${percentage}%</span>
        `;
        categoryList.appendChild(listItem);
    });
}

// 8. Initialize App (UPDATED to load saved category AND populate datalist)
function init() {
    list.innerHTML = '';
    
    // 1. Load the last saved category
    loadLastCategory(); 
    
    // 2. Populate the datalist with used categories
    populateCategoryDatalist(); // Fixed typo: added parentheses ()

    // FIX 2: Sort by date descending (newest first).
    const sortedTransactions = [...transactions].sort((a, b) => {
        // Simple string comparison works for YYYY-MM-DD format (descending order)
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        // If dates are equal, sort by ID (approximate time added)
        if (a.id < b.id) return 1;
        if (a.id > b.id) return -1;
        return 0;
    });

    // Since addTransactionDOM uses appendChild, iterating the sorted array 
    // (newest -> oldest) will build the list correctly from top to bottom.
    sortedTransactions.forEach(addTransactionDOM); 
    
    updateValues(); 
    switchPage('summary-page'); 
}

// Event Listeners (Unchanged)
form.addEventListener('submit', addTransaction);

// Start the application (Unchanged)
init();