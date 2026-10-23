import React, { useEffect, useState } from 'react';
import Nav from './navbar';
import Footer from './footer';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import './App.css';

function Status() {
    const [batches, setBatches] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCommodity, setSelectedCommodity] = useState('ALL');

    // Real-time listener for public stock inventory
    useEffect(() => {
        const batchesRef = collection(db, 'batches');
        const unsubscribeBatches = onSnapshot(batchesRef, (snapshot) => {
            const batchList = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const rem = parseFloat(data.remainingQuantity) || 0;
                // Only display active batches with available stock and eligible quality status
                if (rem > 0 && (!data.qualityStatus || data.qualityStatus.toLowerCase() === 'eligible')) {
                    batchList.push({
                        id: docSnap.id,
                        ...data,
                        remainingQuantity: rem
                    });
                }
            });
            // Sort by receiptDate ascending (FIFO priority)
            batchList.sort((a, b) => new Date(a.receiptDate) - new Date(b.receiptDate));
            setBatches(batchList);
            setLoading(false);
        }, (error) => {
            console.error("Error loading public inventory: ", error);
            setLoading(false);
        });

        // Real-time listener for recent public dispatches
        const dispatchesRef = collection(db, 'dispatches');
        const dispatchesQuery = query(dispatchesRef, orderBy('timestamp', 'desc'), limit(15));
        const unsubscribeDispatches = onSnapshot(dispatchesQuery, (snapshot) => {
            const dispatchList = [];
            snapshot.forEach((docSnap) => {
                dispatchList.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });
            setDispatches(dispatchList);
        }, (err) => {
            console.error("Error fetching public dispatches: ", err);
        });

        return () => {
            unsubscribeBatches();
            unsubscribeDispatches();
        };
    }, []);

    // Commodity Summary Aggregation
    const commoditySummary = batches.reduce((acc, batch) => {
        const comm = batch.commodity || 'Other';
        acc[comm] = (acc[comm] || 0) + batch.remainingQuantity;
        return acc;
    }, {});

    // Search and commodity filter logic
    const filteredBatches = batches.filter((b) => {
        const matchesSearch = 
            (b.batchId && b.batchId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (b.commodity && b.commodity.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (b.godownLocation && b.godownLocation.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCommodity = selectedCommodity === 'ALL' || b.commodity === selectedCommodity;
        return matchesSearch && matchesCommodity;
    });

    return (
        <div className="status-page-wrapper">
            <Nav />

            <main className="status-container">
                {/* Public Header Banner */}
                <div className="status-header">
                    <span className="public-badge">🌐 PUBLIC TRANSPARENCY PORTAL</span>
                    <h1>Public Stock Transparency &amp; iPDS Allocations</h1>
                    <p>Live, unedited stock metrics and public distribution audit trail for AnnaRakshak (iPDS)</p>
                </div>

                {/* Stock Level Cards */}
                <div className="summary-section">
                    <h2 className="section-heading">Available Stock by Commodity</h2>
                    {loading ? (
                        <p className="loading-text">Fetching public inventory metrics...</p>
                    ) : Object.keys(commoditySummary).length === 0 ? (
                        <p className="no-data">No active public inventory records found.</p>
                    ) : (
                        <div className="summary-grid">
                            {Object.entries(commoditySummary).map(([commodity, totalQty]) => (
                                <div key={commodity} className="summary-card">
                                    <span className="comm-title">{commodity}</span>
                                    <span className="comm-qty">{totalQty.toLocaleString()} kg</span>
                                    <span className="comm-status">✓ Quality Verified</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Controls & Search */}
                <div className="status-controls">
                    <input
                        type="text"
                        placeholder="Search by Batch ID, Commodity, or Godown..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="status-input"
                    />
                    <select
                        value={selectedCommodity}
                        onChange={(e) => setSelectedCommodity(e.target.value)}
                        className="status-select"
                    >
                        <option value="ALL">All Commodities</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Rice</option>
                        <option value="Sugar">Sugar</option>
                        <option value="Salt">Salt</option>
                        <option value="Oil">Oil</option>
                        <option value="Chana">Chana</option>
                        <option value="Tuvar Dal">Tuvar Dal</option>
                    </select>
                </div>

                {/* Active Batches Table */}
                <div className="status-card-table">
                    <h2 className="section-heading">Active Stock Batches ({filteredBatches.length})</h2>
                    {loading ? (
                        <p className="loading-text">Loading stock records...</p>
                    ) : filteredBatches.length === 0 ? (
                        <p className="no-data">No matching active batches found.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="public-table">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Commodity</th>
                                        <th>Available Balance</th>
                                        <th>Godown Location</th>
                                        <th>Receipt Date</th>
                                        <th>Quality Status</th>
                                        <th>QR Verification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBatches.map((b) => (
                                        <tr key={b.id}>
                                            <td className="batch-id-cell">{b.batchId}</td>
                                            <td>{b.commodity}</td>
                                            <td className="qty-cell">{b.remainingQuantity} {b.unit || 'kg'}</td>
                                            <td>{b.godownLocation || 'Main Warehouse'}</td>
                                            <td>{b.receiptDate}</td>
                                            <td>
                                                <span className="badge-eligible">ELIGIBLE</span>
                                            </td>
                                            <td>
                                                <a href={`/batch/${b.id}`} target="_blank" rel="noreferrer" className="inspect-link">
                                                    🔍 View QR Batch
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Live Public Dispatch Log */}
                <div className="status-card-table" style={{ marginTop: '30px' }}>
                    <h2 className="section-heading">Recent Dispatches &amp; FPS Deliveries</h2>
                    {dispatches.length === 0 ? (
                        <p className="no-data">No dispatch records logged yet.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="public-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Commodity</th>
                                        <th>Quantity</th>
                                        <th>Destination (FPS ID)</th>
                                        <th>Batch Breakdown / Summary</th>
                                        <th>FIFO Adherence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispatches.map((d) => (
                                        <tr key={d.id}>
                                            <td>{d.dispatchDate || 'N/A'}</td>
                                            <td>{d.commodity || 'Mixed'}</td>
                                            <td className="qty-cell">{d.quantityDispatched} kg</td>
                                            <td>{d.destinationFps}</td>
                                            <td style={{ fontSize: '13px', color: '#ccc' }}>
                                                {d.dispatchSummaryText || (d.batchBreakdown ? d.batchBreakdown.join(" + ") : `Batch ${d.batchId}`)}
                                            </td>
                                            <td>
                                                {d.isFifoBypassed ? (
                                                    <span className="badge-warning" title={d.fifoExceptionReason}>⚠️ FIFO Override</span>
                                                ) : (
                                                    <span className="badge-success">✓ Standard FIFO</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Status;