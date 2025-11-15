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


// --- Tab Switching Logic (Simplified as no splash logic needed) ---

/**
 * Switches the active page content and updates the navigation buttons.
 * @param {string} targetId - The ID of the page section to activate.
 */
function switchPage(targetId) {
    pageContents.forEach(page => page.classList.remove('active'));
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(targetId).classList.add('active');
    
    // Activate the corresponding button
    const targetButton = document.querySelector(`[data-target="${targetId}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    // Run specific updates when switching to a page
    if(targetId === 'summary-page' || targetId === 'history-page') {
        updateValues(); 
        init(); // Re-render history/summary data
    } else if (targetId === 'charts-page') {
        if (balanceChart) balanceChart.destroy(); 
        const currentIncome = incomeDisplay.innerText.replace(/[$,]/g, '');
        const currentExpense = expenseDisplay.innerText.replace(/[$,-]/g, '');
        updateBalanceChart(parseFloat(currentIncome) || 0, parseFloat(currentExpense) || 0);
    } else if (targetId === 'add-page') {
        dateInput.valueAsDate = new Date(); 
    }
}

// Event Listeners for tabs 
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

function addTransaction(e) {
    e.preventDefault();

    const text = textInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    
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
    updateLocalStorage(); 
    init(); 
    
    // Switch to history page after saving
    switchPage('history-page'); 

    // Clear form fields
    textInput.value = '';
    amountInput.value = '';
    categoryInput.value = ''; 
    dateInput.valueAsDate = new Date();
}

form.addEventListener('submit', addTransaction);


window.removeTransaction = function(id) { 
    transactions = transactions.filter(transaction => transaction.id !== id);
    updateLocalStorage();
    init(); 
}


// --- DOM Manipulation ---

function addTransactionDOM(transaction) {
    const sign = transaction.amount < 0 ? '-' : '+';
    const item = document.createElement('li');

    item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');
    
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

function updateValues() {
    const amounts = transactions.map(transaction => transaction.amount);
    
    const total = amounts.reduce((acc, item) => (acc += item), 0);

    const income = amounts
        .filter(item => item > 0)
        .reduce((acc, item) => (acc += item), 0);

    const expense = amounts
            .filter(item => item < 0)
            .reduce((acc, item) => (acc += item), 0) * -1; 

    balanceDisplay.innerText = `$${total.toFixed(2)}`;
    incomeDisplay.innerText = `$${income.toFixed(2)}`;
    expenseDisplay.innerText = `-$${expense.toFixed(2)}`;
    
    if (total >= 0) {
        balanceDisplay.style.color = 'var(--balance-color)';
    } else {
        balanceDisplay.style.color = 'var(--danger-color)';
    }

    updateCategoryBreakdown(expense);
}

function updateCategoryBreakdown(totalExpense) {
    categoryList.innerHTML = '';
    
    if (totalExpense === 0) {
        categoryList.innerHTML = '<li class="empty-state">No expenses recorded yet.</li>';
        return;
    }

    const expenseCategories = transactions
        .filter(t => t.amount < 0)
        .reduce((acc, t) => {
            const categoryName = t.category || 'Uncategorized';
            const amount = Math.abs(t.amount);
            acc[categoryName] = (acc[categoryName] || 0) + amount;
            return acc;
        }, {});

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



// --- Initialization ---

function init() {
    list.innerHTML = ''; 
    transactions.forEach(addTransactionDOM);
    updateValues();
    populateCategoryDatalist();
    loadLastCategory();
    dateInput.valueAsDate = new Date(); // Set date input default
}

// ⭐ IMPORTANT: Since the app starts directly on index.html, call init() immediately.
window.onload = init;