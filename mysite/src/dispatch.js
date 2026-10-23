import React from 'react';
import Nav from './navbar';
import Footer from "./footer";
import './App.css';

function Dispatch() {
    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Stock dispatched successfully under FIFO guidelines!");
    };

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "60px" }}>
            <Nav />

            <main className="container">

                <form className="form-card" onSubmit={handleSubmit}>
                    <h2 className="section-title">Dispatch details & Delivery Challan</h2>

                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="commodity">Commodity Name *</label>
                            <select id="commodity" className="select" required>
                                <option value="">Select commodity</option>
                                <option value="Wheat">Wheat</option>
                                <option value="Rice">Rice</option>
                                <option value="Sugar">Sugar</option>
                                <option value="Salt">Salt</option>
                                <option value="Oil">Oil</option>
                                <option value="Chana">Chana</option>
                                <option value="Tuvar Dal">Tuvar Dal</option>
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="batch">Batch Number (FIFO Recommended) *</label>
                            <select id="batch" className="select" required>
                                <option value="">Select eligible batch</option>
                                <option value="B101">B101 - Oldest Stock (500 kg)</option>
                                <option value="B102">B102 - 400 kg</option>
                                <option value="B103">B103 - 600 kg</option>
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="quantity">Dispatch Quantity (kg) *</label>
                            <input
                                type="number"
                                id="quantity"
                                className="input"
                                min="1"
                                step="1"
                                placeholder="Enter quantity"
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="destination">Fair Price Shop (FPS) ID/Name *</label>
                            <input
                                type="text"
                                id="destination"
                                className="input"
                                placeholder="Enter FPS destination"
                                required
                            />
                        </div>
                    </div>

                    <div className="buttons">
                        <button type="reset" className="clear-btn">
                            Clear Form
                        </button>
                        <button type="submit" className="save-btn">
                            Confirm Dispatch
                        </button>
                    </div>

                    <p id="message" role="status" style={{ marginTop: "15px", fontSize: "14px", color: "#8294aa" }}></p>
                </form>
            </main>

            <Footer />
        </div>
    );
}

export default Dispatch;