import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from './firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import Nav from './navbar';
import Footer from './footer';
import './App.css';

function BatchView() {
    const { id } = useParams();
    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState("");
    const [userName, setUserName] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchBatchAndUser = async () => {
            try {
                // Fetch batch details
                const docRef = doc(db, "batches", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setBatch({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setBatch(null);
                }

                // Fetch current user role and name from Firestore
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userDocRef);
                    if (userSnap.exists()) {
                        setUserRole((userSnap.data().role || "").toLowerCase());
                        setUserName(userSnap.data().name || currentUser.displayName || "Inspector");
                    }
                }
            } catch (error) {
                console.error("Error fetching batch details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBatchAndUser();
    }, [id]);

    const handleStatusUpdate = async (newStatus, statusLabel) => {
        if (!window.confirm(`Are you sure you want to mark this batch as ${statusLabel}?`)) return;

        setUpdating(true);
        try {
            const batchRef = doc(db, "batches", id);
            await updateDoc(batchRef, { qualityStatus: newStatus });

            // Record official inspection action in audit logs
            await addDoc(collection(db, "dispatches"), { // Or logs collection if tracked separately
                type: "INSPECTION_UPDATE",
                title: `Quality ${statusLabel}: ${batch.commodity}`,
                details: `Batch ${batch.batchId} inspection status updated to ${statusLabel} by ${userName} (${userRole}).`,
                dispatchedBy: userName,
                dispatchedByRole: userRole,
                dispatchDate: new Date().toISOString().split('T')[0],
                timestamp: serverTimestamp()
            });

            setBatch(prev => ({ ...prev, qualityStatus: newStatus }));
            alert(`Batch successfully marked as ${statusLabel}!`);
        } catch (error) {
            console.error("Error updating batch status:", error);
            alert("Failed to update status.");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", color: "white", padding: "100px", background: "#1b1616", minHeight: "100vh" }}>
                <h2>Loading batch details...</h2>
            </div>
        );
    }

    if (!batch) {
        return (
            <div style={{ textAlign: "center", color: "white", padding: "100px", background: "#1b1616", minHeight: "100vh" }}>
                <Nav />
                <h2>Batch Not Found</h2>
                <p style={{ color: "#8294aa" }}>The requested consignment batch does not exist or has been removed.</p>
            </div>
        );
    }

    const isInspectionOrAdmin = userRole.includes("admin") || userRole.includes("inspection") || userRole.includes("officer");

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "800px" }}>
                <div className="heading">
                    <h1>Consignment QR Inspection Portal</h1>
                    <p className="dashboard-subtext">Real-time batch verification &amp; quality governance (iPDS)</p>
                </div>

                <div className="form-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "20px" }}>
                        <div>
                            <span style={{ fontSize: "12px", color: "#8294aa", textTransform: "uppercase" }}>Batch Identifier</span>
                            <h2 style={{ margin: "4px 0 0 0", color: "rgb(174, 128, 43)" }}>{batch.batchId}</h2>
                        </div>
                        <div>
                            <span className={`status-badge ${batch.qualityStatus}`}>
                                {batch.qualityStatus ? batch.qualityStatus.toUpperCase() : "PENDING"}
                            </span>
                        </div>
                    </div>

                    <div className="details-grid" style={{ marginBottom: "25px" }}>
                        <div className="detail-box">
                            <label>Commodity</label>
                            <p>{batch.commodity}</p>
                        </div>
                        <div className="detail-box">
                            <label>Remaining Quantity</label>
                            <p>{batch.remainingQuantity} {batch.unit || 'kg'}</p>
                        </div>
                        <div className="detail-box">
                            <label>Initial Quantity</label>
                            <p>{batch.quantity} {batch.unit || 'kg'}</p>
                        </div>
                        <div className="detail-box">
                            <label>Supplier / Provider</label>
                            <p>{batch.supplier}</p>
                        </div>
                        <div className="detail-box">
                            <label>Godown Location</label>
                            <p>{batch.godownLocation}</p>
                        </div>
                        <div className="detail-box">
                            <label>Receipt Date</label>
                            <p>{batch.receiptDate}</p>
                        </div>
                        <div className="detail-box">
                            <label>Expiry / Best Before</label>
                            <p>{batch.expiryDate || 'N/A'}</p>
                        </div>
                        <div className="detail-box">
                            <label>Logged By</label>
                            <p>{batch.addedBy || 'System'} ({batch.addedByRole || 'Manager'})</p>
                        </div>
                    </div>

                    {/* Inspection Officer / Admin Action Panel */}
                    {isInspectionOrAdmin ? (
                        <div style={{ background: "#110e0e", border: "1px solid rgba(174, 128, 43, 0.3)", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
                            <h3 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "16px" }}>Inspection Officer Action Panel</h3>
                            <p style={{ color: "#8294aa", fontSize: "13px", marginBottom: "15px" }}>
                                As an authorized inspector, review the consignment details above and select an official quality status.
                            </p>
                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                <button 
                                    onClick={() => handleStatusUpdate("eligible", "Approved")} 
                                    className="save-btn" 
                                    style={{ background: "#2e7d32", flex: 1 }}
                                    disabled={updating}
                                >
                                    {updating ? "Processing..." : "✓ Approve Batch"}
                                </button>
                                <button 
                                    onClick={() => handleStatusUpdate("pending", "Hold")} 
                                    className="save-btn" 
                                    style={{ background: "#f57c00", flex: 1 }}
                                    disabled={updating}
                                >
                                    {updating ? "Processing..." : "⏸ Hold Batch"}
                                </button>
                                <button 
                                    onClick={() => handleStatusUpdate("rejected", "Rejected")} 
                                    className="save-btn" 
                                    style={{ background: "#c62828", flex: 1 }}
                                    disabled={updating}
                                >
                                    {updating ? "Processing..." : "✕ Reject Batch"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: "#110e0e", border: "1px solid #333", padding: "15px", borderRadius: "8px", textAlign: "center", color: "#8294aa", fontSize: "13px" }}>
                            🔒 Quality inspection actions are restricted to authorized Inspection Officers and Administrators.
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default BatchView;