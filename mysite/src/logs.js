import React, { useEffect, useState } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { db } from './firebase';
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import './App.css';

function Logs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchAuditLogs = async () => {
            try {
                const combinedLogs = [];

                // 1. Fetch Stock Additions
                const batchesSnap = await getDocs(collection(db, "batches"));
                batchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    
                    // Safely parse Firestore timestamp or fallback to current time
                    const rawMillis = data.timestamp?.toMillis ? data.timestamp.toMillis() : new Date(data.receiptDate || Date.now()).getTime();

                    combinedLogs.push({
                        id: docSnap.id,
                        type: "STOCK_ADD",
                        title: `Stock Added: ${data.commodity || 'Item'}`,
                        details: `Batch ${data.batchId || 'N/A'} received (${data.quantity || 0} ${data.unit || 'kg'}) from ${data.supplier || 'Supplier'}. Godown: ${data.godownLocation || 'Main'}.`,
                        userName: data.addedBy || "Galla Singh",
                        userRole: data.addedByRole || "Manager",
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : (data.receiptDate || "N/A"),
                        rawTime: rawMillis,
                        badgeClass: "badge-add"
                    });
                });

                // 2. Fetch Dispatches
                const dispatchesSnap = await getDocs(collection(db, "dispatches"));
                dispatchesSnap.forEach((docSnap) => {
                    const data = docSnap.data();

                    const rawMillis = data.timestamp?.toMillis ? data.timestamp.toMillis() : new Date(data.dispatchDate || Date.now()).getTime();

                    combinedLogs.push({
                        id: docSnap.id,
                        type: "DISPATCH",
                        title: `Stock Dispatched: ${data.commodity || 'Item'}`,
                        details: `Dispatched ${data.quantityDispatched} kg from Batch ${data.batchId || 'N/A'} to ${data.destinationFps || 'FPS Target'}.`,
                        userName: data.dispatchedBy || "Galla Singh",
                        userRole: data.dispatchedByRole || "Manager",
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : (data.dispatchDate || "N/A"),
                        rawTime: rawMillis,
                        badgeClass: "badge-dispatch"
                    });
                });

                // Sort descending: Latest activity shown at the top
                combinedLogs.sort((a, b) => b.rawTime - a.rawTime);
                setLogs(combinedLogs);

            } catch (error) {
                console.error("Error fetching audit logs: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAuditLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesType = filterType === "ALL" || log.type === filterType;
        const matchesSearch = 
            (log.title && log.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.userRole && log.userRole.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesType && matchesSearch;
    });

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "1100px" }}>

                <div className="inventory-controls form-card">
                    <div className="search-group">
                        <input
                            type="text"
                            placeholder="Search by keyword, user name, or role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                        />
                    </div>
                    <div className="filter-group" style={{ flex: "none", width: "220px" }}>
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            className="select"
                        >
                            <option value="ALL">All Event Types</option>
                            <option value="STOCK_ADD">Stock Creations</option>
                            <option value="DISPATCH">Dispatches</option>
                        </select>
                    </div>
                </div>

                <div className="form-card" style={{ marginTop: "20px" }}>
                    <h2 className="section-title">Audit Trail History</h2>

                    {loading ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "20px" }}>Loading audit logs...</p>
                    ) : filteredLogs.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "20px" }}>No matching activity logs found.</p>
                    ) : (
                        <div className="logs-timeline">
                            {filteredLogs.map((log) => (
                                <div className="log-item" key={log.id}>
                                    <div className="log-header">
                                        <span className={`log-badge ${log.badgeClass}`}>
                                            {log.type === "STOCK_ADD" ? "Stock Inward" : "Dispatch Outward"}
                                        </span>
                                        <span className="log-time">{log.timestamp}</span>
                                    </div>
                                    <h3 className="log-title">{log.title}</h3>
                                    <p className="log-details">{log.details}</p>
                                    <div className="log-footer">
                                        <span className="log-user">
                                            Performed by: <strong>{log.userName}</strong> ({log.userRole})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default Logs;