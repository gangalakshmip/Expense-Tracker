// --- DOM Elements ---
const balanceDisplay = document.getElementById('balance');
const incomeDisplay = document.getElementById('total-income');
const expenseDisplay = document.getElementById('total-expense');
const list = document.getElementById('list');
const form = document.getElementById('transaction-form');
const textInput = document.getElementById('text');
const dateInput = document.getElementById('date'); 
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const categoryList = document.getElementById('category-list');
const balanceChartCanvas = document.getElementById('balance-chart');
const categoryDatalist = document.getElementById('category-options');

// ⭐ Splash/Nav Elements ⭐
const splashPage = document.getElementById('splash-page');
const startAppButton = document.getElementById('start-app-btn');
const mainNav = document.getElementById('main-nav'); 


// Tab Navigation 
const tabButtons = document.querySelectorAll('.tab-btn');
const pageContents = document.querySelectorAll('.page-content');

// LocalStorage & State 
const localStorageTransactions = JSON.parse(localStorage.getItem('transactions'));
let transactions = localStorageTransactions !== null ? localStorageTransactions : [];
let balanceChart; // Chart instance for Income vs Expense


// --- Persistence Logic ---

function saveLastCategory(categoryValue) {
    localStorage.setItem('lastCategory', categoryValue);
}

function loadLastCategory() {
    const lastCategory = localStorage.getItem('lastCategory');
    if (lastCategory) {
        categoryInput.value = lastCategory;
    }
}

function updateLocalStorage() {
    // Sort transactions by date descending for better history view
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem('transactions', JSON.stringify(transactions));
}


// --- Tab & Splash Switching Logic ---

/**
 * Switches the active page content and updates the navigation buttons.
 * @param {string} targetId - The ID of the page section to activate.
 */
function switchPage(targetId) {
    pageContents.forEach(page => page.classList.remove('active'));
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(targetId).classList.add('active');
    
    // Only attempt to find and activate the button if it's one of the main tabs
    if (targetId !== 'splash-page') {
        const targetButton = document.querySelector(`[data-target="${targetId}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }
    
    // Run specific updates when switching to a page
    if(targetId === 'summary-page' || targetId === 'history-page') {
        updateValues(); 
        init(); // Re-render history/summary data
    } else if (targetId === 'charts-page') {
        // Destroy and recreate chart to prevent drawing issues when tab changes
        if (balanceChart) balanceChart.destroy(); 
        const currentIncome = incomeDisplay.innerText.replace(/[$,]/g, '');
        const currentExpense = expenseDisplay.innerText.replace(/[$,-]/g, '');
        updateBalanceChart(parseFloat(currentIncome) || 0, parseFloat(currentExpense) || 0);
    } else if (targetId === 'add-page') {
        dateInput.valueAsDate = new Date(); // Reset date to today on form load
    }
}

/**
 * Initial function to transition from the splash page to the main app.
 */
function initializeApp() {
    // 1. Hide the splash screen
    splashPage.classList.remove('active');
    
    // 2. Show the main navigation bar
    mainNav.style.display = 'flex';
    
    // 3. Switch to the default starting page (Summary)
    switchPage('summary-page');
    
    // 4. Run core app initialization (load data, populate history, etc.)
    init();
}

// Event Listeners for tabs and the 'Get Started' button
if (startAppButton) {
    startAppButton.addEventListener('click', initializeApp);
}

tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        switchPage(target);
    });
});

// Category & Amount Input Handlers for persistence
categoryInput.addEventListener('input', () => { saveLastCategory(categoryInput.value); });
amountInput.addEventListener('input', () => { saveLastCategory(categoryInput.value); });


// --- DYNAMIC DATALIST POPULATION ---

function populateCategoryDatalist() {
    const defaultOptions = ['Income', 'Food', 'Travel', 'Utilities', 'Entertainment', 'Other', 'Uncategorized'];
    const uniqueUsedCategories = new Set();
    
    transactions.forEach(t => {
        // Only include non-Income categories from past transactions
        if (t.category && t.category.trim() !== '' && t.category.toLowerCase() !== 'income') {
            uniqueUsedCategories.add(t.category);
        }
    });

    const finalCategories = [...new Set([...defaultOptions, ...uniqueUsedCategories])];

    categoryDatalist.innerHTML = ''; 
    finalCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoryDatalist.appendChild(option);
    });
}


// --- CRUD Operations ---

function generateID() {
    return Math.floor(Math.random() * 100000000);
}

/**
 * Adds a new transaction to the array.
 */
function addTransaction(e) {
    e.preventDefault();

    const text = textInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    
    // Determine category: default to 'Income' if positive, 'Uncategorized' if negative and blank
    let category = categoryInput.value.trim();
    if (!category) {
        category = amount > 0 ? 'Income' : 'Uncategorized';
    }


    if (!text || isNaN(amount) || amount === 0 || !date) {
        alert('Please enter a valid description, date, and a non-zero amount!');
        return;
    }

    const transaction = {
        id: generateID(),
        text: text,
        amount: amount,
        category: category,
        date: date
    };

    transactions.push(transaction);
    updateLocalStorage(); // Save first
    init(); // Re-render everything
    
    // Switch to history page after saving
    switchPage('history-page'); 

    // Clear form fields
    textInput.value = '';
    amountInput.value = '';
    categoryInput.value = ''; 
    dateInput.valueAsDate = new Date();
}

form.addEventListener('submit', addTransaction);


/**
 * Deletes a transaction by ID.
 * @param {number} id - The ID of the transaction to delete.
 */
window.removeTransaction = function(id) { // Exposed to global scope for inline onclick
    transactions = transactions.filter(transaction => transaction.id !== id);
    updateLocalStorage();
    init(); // Re-initialize to update all displays
}


// --- DOM Manipulation ---

/**
 * Creates the DOM element for a single transaction in the history list.
 * @param {Object} transaction - The transaction object.
 */
function addTransactionDOM(transaction) {
    const sign = transaction.amount < 0 ? '-' : '+';
    const item = document.createElement('li');

    // Add class based on value
    item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');
    
    // Format date for display
    const formattedDate = new Date(transaction.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    item.innerHTML = `
        <div class="transaction-details">
            <span class="transaction-text">${transaction.text} (${transaction.category})</span>
            <span class="transaction-date">${formattedDate}</span>
        </div>
        <span>${sign}$${Math.abs(transaction.amount).toFixed(2)}</span>
        <button onclick="removeTransaction(${transaction.id})" class="delete-btn">X</button>
    `;

    list.prepend(item);
}

/**
 * Updates the balance, income, and expense displays.
 */
function updateValues() {
    const amounts = transactions.map(transaction => transaction.amount);
    
    const total = amounts.reduce((acc, item) => (acc += item), 0);

    const income = amounts
        .filter(item => item > 0)
        .reduce((acc, item) => (acc += item), 0);

    const expense = amounts
            .filter(item => item < 0)
            .reduce((acc, item) => (acc += item), 0) * -1; // Positive value for display

    balanceDisplay.innerText = `$${total.toFixed(2)}`;
    incomeDisplay.innerText = `$${income.toFixed(2)}`;
    expenseDisplay.innerText = `-$${expense.toFixed(2)}`;
    
    // Update balance color dynamically
    if (total >= 0) {
        balanceDisplay.style.color = 'var(--balance-color)';
    } else {
        balanceDisplay.style.color = 'var(--danger-color)';
    }

    updateCategoryBreakdown(expense);
}

/**
 * Updates the expense breakdown list on the summary page.
 * @param {number} totalExpense - The total expense amount as a number.
 */
function updateCategoryBreakdown(totalExpense) {
    categoryList.innerHTML = '';
    
    if (totalExpense === 0) {
        categoryList.innerHTML = '<li class="empty-state">No expenses recorded yet.</li>';
        return;
    }

    // Filter and group expenses by category
    const expenseCategories = transactions
        .filter(t => t.amount < 0)
        .reduce((acc, t) => {
            const categoryName = t.category || 'Uncategorized';
            const amount = Math.abs(t.amount);
            acc[categoryName] = (acc[categoryName] || 0) + amount;
            return acc;
        }, {});

    // Create list items
    Object.entries(expenseCategories).forEach(([category, amount]) => {
        const percentage = ((amount / totalExpense) * 100).toFixed(1);
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span class="category-name">${category}</span>
            <span class="category-percentage">${percentage}%</span>
            <span class="category-amount">-$${amount.toFixed(2)}</span>
        `;
        categoryList.appendChild(listItem);
    });
}


// --- Chart.js Integration ---

/**
 * Initializes or updates the Chart.js balance chart (Doughnut).
 * @param {number} income - Total income amount.
 * @param {number} expense - Total expense amount.
 */
function updateBalanceChart(income, expense) {
    if (balanceChart) {
        balanceChart.destroy(); // Destroy previous instance if it exists
    }
    
    const ctx = balanceChartCanvas.getContext('2d');
    
    balanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Income', 'Total Expenses'],
            datasets: [{
                data: [income, expense],
                backgroundColor: [
                    '#4CAF50', // Success color (Green)
                    '#FF5252'  // Danger color (Red)
                ],
                hoverBackgroundColor: [
                    '#5cb860',
                    '#ff6666'
                ],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'var(--text-color)',
                        font: { family: 'Inter', size: 14, weight: '600' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += '$' + context.parsed.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


// --- Initialization ---

/**
 * Main initialization function. Clears history list, adds all transactions, and updates summary.
 */
function init() {
    list.innerHTML = ''; // Clear history list
    transactions.forEach(addTransactionDOM);
    updateValues();
    populateCategoryDatalist();
    loadLastCategory();
}

// Initial check: if the main navigation is visible, the splash screen was bypassed 
// (e.g., on refresh after first load, or if 'active' was left on summary page).
// If the app is starting fresh (splash page is active), init() is called by initializeApp().
if (splashPage && !splashPage.classList.contains('active')) {
    // If the splash page is NOT active on load, it means we are directly showing the app.
    mainNav.style.display = 'flex';
    init();
} else if (!splashPage) {
     // Fallback if splash page was accidentally removed from HTML
    mainNav.style.display = 'flex';
    init();
}