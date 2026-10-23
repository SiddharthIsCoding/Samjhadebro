import React, { useEffect, useState } from 'react';
import './App.css';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

function Dashboard() {
    const [userName, setUserName] = useState("");
    const [role, setRole] = useState("");
    const [user, setUser] = useState(null);

    // Live inventory & analytics state
    const [totalBatches, setTotalBatches] = useState(0);
    const [totalStockKg, setTotalStockKg] = useState(0);
    const [fifoCompliance, setFifoCompliance] = useState("100%");
    const [complianceNum, setComplianceNum] = useState(100);
    
    const [pendingDispatches, setPendingDispatches] = useState(0);
    const [loading, setLoading] = useState(true);

    // Alert states
    const [alerts, setAlerts] = useState([]);

    const [stockData, setStockData] = useState([]);
    const [batchAgeData, setBatchAgeData] = useState([
        { name: '0 - 30 days', value: 0, color: '#4CAF50' },
        { name: '31 - 60 days', value: 0, color: '#1976d2' },
        { name: '61 - 90 days', value: 0, color: '#ffa000' },
        { name: '> 90 days', value: 0, color: '#f44336' }
    ]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserName(currentUser.displayName || "Godown Manager");

                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        setRole(docSnap.data().role);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }
            } else {
                setUserName("");
                setRole("");
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    // Fetch live dashboard data from Firestore & evaluate alert triggers
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const activeAlerts = [];
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];

                // 1. Fetch Batches
                const batchesSnap = await getDocs(collection(db, "batches"));
                let batchCount = 0;
                let totalQty = 0;
                const commodityTotals = {};

                let age0_30 = 0;
                let age31_60 = 0;
                let age61_90 = 0;
                let age90Plus = 0;
                let expiredCount = 0;

                batchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const remQty = parseFloat(data.remainingQuantity) || 0;

                    if (remQty > 0) {
                        batchCount++;
                        totalQty += remQty;

                        // Aggregate quantity by commodity
                        const comm = data.commodity || "Other";
                        commodityTotals[comm] = (commodityTotals[comm] || 0) + remQty;

                        // Expiry Check
                        if (data.expiryDate && data.expiryDate < todayStr) {
                            expiredCount++;
                        }

                        // Calculate batch age in days based on receiptDate
                        if (data.receiptDate) {
                            const recDate = new Date(data.receiptDate);
                            const diffTime = Math.abs(today - recDate);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays <= 30) age0_30++;
                            else if (diffDays <= 60) age31_60++;
                            else if (diffDays <= 90) age61_90++;
                            else age90Plus++;
                        } else {
                            age0_30++;
                        }
                    }
                });

                setTotalBatches(batchCount);
                setTotalStockKg(Math.round(totalQty));

                // Format commodity totals for BarChart
                const formattedStockData = Object.keys(commodityTotals).map((key) => ({
                    commodity: key,
                    quantity: commodityTotals[key]
                }));
                setStockData(formattedStockData);

                // Format batch age data for PieChart
                setBatchAgeData([
                    { name: '0 - 30 days', value: age0_30, color: '#4CAF50' },
                    { name: '31 - 60 days', value: age31_60, color: '#1976d2' },
                    { name: '61 - 90 days', value: age61_90, color: '#ffa000' },
                    { name: '> 90 days', value: age90Plus, color: '#f44336' }
                ]);

                // 2. Fetch Dispatches & Calculate FIFO Compliance
                const dispatchesSnap = await getDocs(collection(db, "dispatches"));
                setPendingDispatches(dispatchesSnap.size);

                let dispatchCount = 0;
                let fifoBypassedCount = 0;

                dispatchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    dispatchCount += 1;
                    
                    if (data.isFifoBypassed === true || (data.fifoExceptionReason && !data.fifoExceptionReason.startsWith("N/A"))) {
                        fifoBypassedCount += 1;
                    }
                });

                let currentCompliance = 100;
                if (dispatchCount > 0) {
                    const compliantCount = dispatchCount - fifoBypassedCount;
                    currentCompliance = Math.max(0, Math.round((compliantCount / dispatchCount) * 100));
                }
                
                setComplianceNum(currentCompliance);
                setFifoCompliance(`${currentCompliance}%`);

                // --- EVALUATE SYSTEM ALERTS ---
                // Alert 1: FIFO Compliance below 90%
                if (currentCompliance < 90) {
                    activeAlerts.push({
                        type: "danger",
                        title: "Critical FIFO Compliance Warning",
                        message: `FIFO adherence has dropped to ${currentCompliance}% (Below target threshold of 90%). Too many dispatches are bypassing older batches.`
                    });
                }

                // Alert 2: Too Old Stocks (>90 Days)
                if (age90Plus > 0) {
                    activeAlerts.push({
                        type: "warning",
                        title: "Aged Stock Risk Alert",
                        message: `There are ${age90Plus} active batch(es) in the warehouse stored for over 90 days. Immediate dispatch or inspection recommended.`
                    });
                }

                // Alert 3: Expired Stocks Hazard
                if (expiredCount > 0) {
                    activeAlerts.push({
                        type: "danger",
                        title: "Expired Stock Hazard",
                        message: `Detected ${expiredCount} batch(es) that have passed their expiry date. These are locked out of dispatch and require disposal/audit review.`
                    });
                }

                // Alert 4: Low Stock Warning (if total stock is very low)
                if (totalQty > 0 && totalQty < 500) {
                    activeAlerts.push({
                        type: "warning",
                        title: "Low Inventory Reserve",
                        message: `Total warehouse stock has dipped to ${totalQty} kg. Consider raising inward requisitions soon.`
                    });
                }

                setAlerts(activeAlerts);

            } catch (error) {
                console.error("Error loading dashboard metrics: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "60px" }}>
            <Nav />

            <div onClick={() => {
                const form = document.getElementById('class-form');
                const filter = document.getElementById('blackfilter');
                if (form) form.style.display = 'none';
                if (filter) filter.style.display = 'none';
            }} id="blackfilter"></div>

            {/* KPI Summary Cards Grid */}
            <div className="kpi-grid">
                <div className="kpi-card" style={{ borderLeft: "5px solid rgb(174, 128, 43)" }}>
                    <h4>Total Active Batches</h4>
                    <h2>{loading ? "..." : totalBatches}</h2>
                    <p>Active consignments</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #4CAF50" }}>
                    <h4>Total Stock Volume</h4>
                    <h2>{loading ? "..." : `${totalStockKg.toLocaleString()} kg`}</h2>
                    <p>Across all commodities</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: `5px solid ${complianceNum < 90 ? '#f44336' : '#1976d2'}` }}>
                    <h4>FIFO Compliance</h4>
                    <h2 style={{ color: complianceNum < 90 ? '#f44336' : 'inherit' }}>{loading ? "..." : fifoCompliance}</h2>
                    <p>Batch rotation adherence</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #ffa000" }}>
                    <h4>Total Dispatches</h4>
                    <h2>{loading ? "..." : `${pendingDispatches} Records`}</h2>
                    <p>Challans generated</p>
                </div>
            </div>

            {/* --- SYSTEM ALERT CENTER --- */}
            {!loading && alerts.length > 0 && (
                <div style={{ maxWidth: "1240px", margin: "0 auto 25px auto", padding: "0 20px" }}>
                    <div style={{ background: "#0e0b0b", border: "1px solid #333", borderRadius: "10px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 15px 0", color: "#fff", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                            Critical Alert ({alerts.length})
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {alerts.map((alert, idx) => (
                                <div 
                                    key={idx} 
                                    style={{ 
                                        background: alert.type === "danger" ? "rgba(244, 67, 54, 0.1)" : "rgba(255, 160, 0, 0.1)",
                                        borderLeft: `4px solid ${alert.type === "danger" ? "#f44336" : "#ffa000"}`,
                                        padding: "12px 15px",
                                        borderRadius: "6px"
                                    }}
                                >
                                    <h4 style={{ margin: "0 0 4px 0", color: alert.type === "danger" ? "#ff5252" : "#ffb300", fontSize: "14px" }}>
                                        {alert.title}
                                    </h4>
                                    <p style={{ margin: 0, color: "#ccc", fontSize: "13px", lineHeight: "1.4" }}>
                                        {alert.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Section */}
            <div className="charts-grid">
                {/* Pie Chart Card: Batch Age */}
                <div id="piechart">
                    <div className="chart-title">Batch Age Distribution</div>
                    <div className="chart-subtitle">Active Batches in stock: {totalBatches}</div>
                    <div className="pie-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={batchAgeData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={80} 
                                    innerRadius={45}
                                >
                                    {batchAgeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#060505', borderColor: '#444', color: '#fff', borderRadius: '8px' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart Card: Commodity Levels */}
                <div id="piechart">
                    <div className="chart-title">Commodity Stock Levels</div>
                    <div className="chart-subtitle">Available quantity by item type (kg)</div>
                    <div className="pie-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            {stockData.length === 0 ? (
                                <p style={{ textAlign: "center", color: "#8294aa", paddingTop: "80px" }}>No stock available</p>
                            ) : (
                                <BarChart data={stockData}>
                                    <XAxis dataKey="commodity" stroke="#8294aa" fontSize={12} />
                                    <YAxis stroke="#8294aa" fontSize={12} />
                                    <Tooltip contentStyle={{ background: '#060505', borderColor: '#444', color: '#fff', borderRadius: '8px' }} />
                                    <Bar dataKey="quantity" fill="rgb(174, 128, 43)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default Dashboard;