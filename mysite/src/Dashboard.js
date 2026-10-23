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
    const [pendingDispatches, setPendingDispatches] = useState(0);
    const [loading, setLoading] = useState(true);

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

    // Fetch live dashboard data from Firestore
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Fetch Batches
                const batchesSnap = await getDocs(collection(db, "batches"));
                let batchCount = 0;
                let totalQty = 0;
                const commodityTotals = {};

                let age0_30 = 0;
                let age31_60 = 0;
                let age61_90 = 0;
                let age90Plus = 0;

                const today = new Date();

                batchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const remQty = parseFloat(data.remainingQuantity) || 0;

                    if (remQty > 0) {
                        batchCount++;
                        totalQty += remQty;

                        // Aggregate quantity by commodity
                        const comm = data.commodity || "Other";
                        commodityTotals[comm] = (commodityTotals[comm] || 0) + remQty;

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

                // 2. Fetch Dispatches count
                const dispatchesSnap = await getDocs(collection(db, "dispatches"));
                setPendingDispatches(dispatchesSnap.size);

                // Calculate FIFO compliance based on aged batches (>90 days reduce score)
                if (batchCount > 0) {
                    const nonCompliant = age90Plus;
                    const complianceRate = Math.max(0, Math.round(((batchCount - nonCompliant) / batchCount) * 100));
                    setFifoCompliance(`${complianceRate}%`);
                }

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

            {/* Dashboard Header Banner */}


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
                <div className="kpi-card" style={{ borderLeft: "5px solid #1976d2" }}>
                    <h4>FIFO Compliance</h4>
                    <h2>{loading ? "..." : fifoCompliance}</h2>
                    <p>Batch rotation adherence</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #ffa000" }}>
                    <h4>Total Dispatches</h4>
                    <h2>{loading ? "..." : `${pendingDispatches} Records`}</h2>
                    <p>Challans generated</p>
                </div>
            </div>

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