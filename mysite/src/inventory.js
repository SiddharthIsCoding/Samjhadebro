import React, { useEffect, useState } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { db } from './firebase';
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import './App.css';

function Inventory() {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCommodity, setSelectedCommodity] = useState("All");

    // Fetch batches from Firestore on load
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const q = query(collection(db, "batches"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                const batchList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setBatches(batchList);
            } catch (error) {
                console.error("Error fetching inventory batches: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBatches();
    }, []);

    // Filter logic for search and commodity filter
    const filteredBatches = batches.filter(batch => {
        const matchesSearch = 
            (batch.batchId && batch.batchId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (batch.supplier && batch.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (batch.godownLocation && batch.godownLocation.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCommodity = selectedCommodity === "All" || batch.commodity === selectedCommodity;

        return matchesSearch && matchesCommodity;
    });

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "1200px" }}>


                {/* Search & Filter Bar */}
                <div className="inventory-controls form-card">
                    <div className="search-group">
                        <input
                            type="text"
                            placeholder="Search by Batch ID, Supplier, or Godown..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                        />
                    </div>
                    <div className="filter-group">
                        <select 
                            value={selectedCommodity} 
                            onChange={(e) => setSelectedCommodity(e.target.value)}
                            className="select"
                        >
                            <option value="All">All Commodities</option>
                            <option value="Wheat">Wheat</option>
                            <option value="Rice">Rice</option>
                            <option value="Sugar">Sugar</option>
                            <option value="Salt">Salt</option>
                            <option value="Oil">Oil</option>
                            <option value="Chana">Chana</option>
                            <option value="Tuvar Dal">Tuvar Dal</option>
                        </select>
                    </div>
                </div>

                {/* Inventory Table Container */}
                <div className="form-card" style={{ marginTop: "20px", overflowX: "auto" }}>
                    <h2 className="section-title">Active Consignment Batches</h2>

                    {loading ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "20px" }}>Loading inventory data...</p>
                    ) : filteredBatches.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "20px" }}>No stock batches found.</p>
                    ) : (
                        <table className="inventory-table">
                            <thead>
                                <tr>
                                    <th>Batch ID</th>
                                    <th>Commodity</th>
                                    <th>Quantity Remaining</th>
                                    <th>Supplier</th>
                                    <th>Godown</th>
                                    <th>Receipt Date</th>
                                    <th>Quality Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBatches.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: "bold", color: "rgb(174, 128, 43)" }}>{item.batchId}</td>
                                        <td>{item.commodity}</td>
                                        <td>{item.remainingQuantity} {item.unit || 'kg'}</td>
                                        <td>{item.supplier}</td>
                                        <td>{item.godownLocation}</td>
                                        <td>{item.receiptDate}</td>
                                        <td>
                                            <span className={`status-badge ${item.qualityStatus}`}>
                                                {item.qualityStatus === 'eligible' ? 'Eligible' : item.qualityStatus || 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Inventory;