import React, { useEffect, useState } from 'react';
import './App.css';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
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
    const [totalBatches, setTotalBatches] = useState(18);
    const [totalStockKg, setTotalStockKg] = useState(15420);
    const [fifoCompliance, setFifoCompliance] = useState("98.5%");
    const [pendingDispatches, setPendingDispatches] = useState(6);

    const [stockData] = useState([
        { commodity: 'Rice', quantity: 4500 },
        { commodity: 'Wheat', quantity: 6200 },
        { commodity: 'Sugar', quantity: 1800 },
        { commodity: 'Dal', quantity: 1600 },
        { commodity: 'Salt', quantity: 1320 }
    ]);

    const [batchAgeData] = useState([
        { name: '0 - 30 days', value: 8, color: '#4CAF50' },
        { name: '31 - 60 days', value: 5, color: '#1976d2' },
        { name: '61 - 90 days', value: 3, color: '#ffa000' },
        { name: '> 90 days', value: 2, color: '#f44336' }
    ]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserName(currentUser.displayName || "Lallu Singh");

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
            <div className="dashboard-header">
                <div>
                    <h2 style={{ margin: 0, fontSize: "28px", color: "white" }}>Godown Control Center</h2>
                    <p className="dashboard-subtext">Integrated Public Distribution System (iPDS) - FIFO Stock Monitoring</p>
                </div>
            </div>

            {/* KPI Summary Cards Grid */}
            <div className="kpi-grid">
                <div className="kpi-card" style={{ borderLeft: "5px solid rgb(174, 128, 43)" }}>
                    <h4>Total Batches</h4>
                    <h2>{totalBatches}</h2>
                    <p>Active consignments</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #4CAF50" }}>
                    <h4>Total Stock Volume</h4>
                    <h2>{totalStockKg.toLocaleString()} kg</h2>
                    <p>Across all commodities</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #1976d2" }}>
                    <h4>FIFO Compliance</h4>
                    <h2>{fifoCompliance}</h2>
                    <p>Strict batch adherence</p>
                </div>
                <div className="kpi-card" style={{ borderLeft: "5px solid #ffa000" }}>
                    <h4>Pending Dispatches</h4>
                    <h2>{pendingDispatches} FPS</h2>
                    <p>Awaiting Challan release</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
                {/* Existing Pie Chart Card */}
                <div id="piechart">
                    <div className="chart-title">Batch Age Distribution</div>
                    <div className="chart-subtitle">Total Batches in stock : {totalBatches}</div>
                    <div className="pie-chart-container">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie 
                                    data={batchAgeData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={85} 
                                    innerRadius={50}
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

                {/* Bar Chart Card: Commodity-wise Levels */}
                <div id="piechart">
                    <div className="chart-title">Commodity Stock Levels</div>
                    <div className="chart-subtitle">Available quantity by item type (kg)</div>
                    <div className="pie-chart-container">
                        <ResponsiveContainer>
                            <BarChart data={stockData}>
                                <XAxis dataKey="commodity" stroke="#8294aa" fontSize={12} />
                                <YAxis stroke="#8294aa" fontSize={12} />
                                <Tooltip contentStyle={{ background: '#060505', borderColor: '#444', color: '#fff', borderRadius: '8px' }} />
                                <Bar dataKey="quantity" fill="rgb(174, 128, 43)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default Dashboard;