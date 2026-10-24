import React, { useEffect, useState } from 'react';
import Nav from './navbar';
import Footer from './footer';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { linearRegression, linearRegressionLine } from 'simple-statistics';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import './App.css';

function AIForecast() {
    const [loading, setLoading] = useState(true);
    const [forecastChartData, setForecastChartData] = useState([]);
    const [mlCommodityInsights, setMlCommodityInsights] = useState([]);

    useEffect(() => {
        const trainMLAndPredict = async () => {
            try {
                // 1. Fetch current live stock per commodity
                const batchesSnap = await getDocs(collection(db, "batches"));
                const currentStockMap = {};

                batchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const comm = data.commodity || "Other";
                    const rem = parseFloat(data.remainingQuantity) || 0;
                    currentStockMap[comm] = (currentStockMap[comm] || 0) + rem;
                });

                // 2. Fetch dispatch history & order chronologically
                const dispatchesSnap = await getDocs(collection(db, "dispatches"));
                const dispatchesByCommodity = {};

                dispatchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const comm = data.commodity || "Wheat";
                    const qty = parseFloat(data.quantityDispatched) || 0;
                    const timestamp = data.timestamp ? data.timestamp.toDate().getTime() : Date.now();

                    if (!dispatchesByCommodity[comm]) {
                        dispatchesByCommodity[comm] = [];
                    }
                    dispatchesByCommodity[comm].push({ timestamp, qty });
                });

                const insights = [];
                const projectedChartDays = [];

                // Initialize 7 projection time steps
                for (let i = 1; i <= 7; i++) {
                    projectedChartDays.push({ day: `Day +${i}` });
                }

                // 3. Perform ML Training & Regression for each commodity
                const commodities = Object.keys(currentStockMap);

                commodities.forEach((comm) => {
                    const history = dispatchesByCommodity[comm] || [];
                    const currentStock = currentStockMap[comm] || 0;

                    let predictedDailyConsumption = 25; // Fallback baseline if insufficient history

                    if (history.length >= 2) {
                        // Sort history by time
                        history.sort((a, b) => a.timestamp - b.timestamp);
                        const baseTime = history[0].timestamp;

                        // Map training data points: X = Days elapsed, Y = Quantity dispatched
                        const mlPoints = history.map((entry) => {
                            const daysElapsed = (entry.timestamp - baseTime) / (1000 * 60 * 60 * 24);
                            return [daysElapsed, entry.qty];
                        });

                        // Fit OLS Linear Regression model: y = mx + b
                        const model = linearRegression(mlPoints);
                        const predictLine = linearRegressionLine(model);

                        // Estimate mean predicted daily consumption rate from regression model
                        const latestDayX = mlPoints[mlPoints.length - 1][0];
                        const predictedQty = predictLine(latestDayX + 1);
                        predictedDailyConsumption = Math.max(5, Math.round(predictedQty));
                    } else if (history.length === 1) {
                        predictedDailyConsumption = Math.max(10, Math.round(history[0].qty));
                    }

                    // Calculate stock run-out horizon
                    const daysRemaining = predictedDailyConsumption > 0 
                        ? Math.round(currentStock / predictedDailyConsumption) 
                        : 999;

                    let riskLevel = "Optimal Stocking";
                    let riskColor = "#4CAF50";

                    if (daysRemaining <= 5) {
                        riskLevel = "CRITICAL: High Stock-Out Risk";
                        riskColor = "#f44336";
                    } else if (daysRemaining <= 12) {
                        riskLevel = "WARNING: Reorder Requisition Advised";
                        riskColor = "#ffa000";
                    }

                    insights.push({
                        commodity: comm,
                        stock: currentStock,
                        dailyBurn: predictedDailyConsumption,
                        daysLeft: daysRemaining,
                        risk: riskLevel,
                        color: riskColor
                    });

                    // Populate 7-day predictive depletion line chart
                    for (let step = 0; step < 7; step++) {
                        const remainingAtStep = Math.max(0, Math.round(currentStock - ((step + 1) * predictedDailyConsumption)));
                        projectedChartDays[step][comm] = remainingAtStep;
                    }
                });

                setMlCommodityInsights(insights);
                setForecastChartData(projectedChartDays);

            } catch (error) {
                console.error("Error in ML model regression processing:", error);
            } finally {
                setLoading(false);
            }
        };

        trainMLAndPredict();
    }, []);

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px", backgroundColor: "#1b1616", color: "#fff" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "1200px" }}>


                {loading ? (
                    <p style={{ textAlign: "center", color: "#8294aa", padding: "50px" }}>Training Ordinary Least Squares regression model on dispatch history...</p>
                ) : (
                    <>
                        {/* ML Insight Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                            {mlCommodityInsights.map((item, idx) => (
                                <div key={idx} className="form-card" style={{ borderLeft: `5px solid ${item.color}`, padding: "20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <h3 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>{item.commodity}</h3>
                                        <span style={{ fontSize: "10px", fontWeight: "bold", color: item.color, background: `${item.color}22`, padding: "4px 8px", borderRadius: "4px" }}>
                                            {item.risk}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#b0bec5" }}>
                                        <span>Current Inventory: <strong style={{ color: "#fff" }}>{item.stock.toLocaleString()} kg</strong></span>
                                        <span>ML Regressed Daily Burn: <strong style={{ color: "#fff" }}>~{item.dailyBurn} kg/day</strong></span>
                                        <span>Estimated Exhaustion: <strong style={{ color: item.color }}>{item.daysLeft} days remaining</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Predictive Line Chart */}
                        <div className="form-card" style={{ padding: "25px" }}>
                            <h2 className="section-title">Next 7 Days ML Projected Stock Depletion Curve</h2>

                            <div style={{ width: "100%", height: "420px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={forecastChartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="day" stroke="#8294aa" tick={{ fontSize: 12 }} dy={10} />
                                        <YAxis stroke="#8294aa" tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                background: "#060505", 
                                                border: "1px solid #333", 
                                                borderRadius: "8px", 
                                                padding: "8px 12px" 
                                            }} 
                                            itemStyle={{ 
                                                color: "#fff", 
                                                fontSize: "12px", 
                                                padding: "2px 0" 
                                            }} 
                                            labelStyle={{ 
                                                color: "rgb(174, 128, 43)", 
                                                fontWeight: "bold", 
                                                fontSize: "13px", 
                                                marginBottom: "4px" 
                                            }} 
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                                        <Line type="monotone" dataKey="Wheat" stroke="rgb(181, 144, 74)" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Rice" stroke="#4CAF50" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Sugar" stroke="#1976d2" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Salt" stroke="#9c27b0" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Oil" stroke="#d9ff00" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Chana" stroke="#ff0000" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Tuvar Dal" stroke="#ff8800" strokeWidth={2} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}

export default AIForecast;