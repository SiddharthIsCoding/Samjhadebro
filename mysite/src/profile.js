import React, { useEffect, useState } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from './firebase';
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import './App.css';

function Profile() {
    const [userData, setUserData] = useState({
        name: "Loading...",
        email: "Loading...",
        role: "Loading...",
        system: "AnnaRakshak (iPDS)"
    });

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                let roleVal = "Admin";
                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        roleVal = docSnap.data().role || "Admin";
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }

                setUserData({
                    name: currentUser.displayName || "Godown Manager",
                    email: currentUser.email || "admin@annarakshak.in",
                    role: roleVal,
                    system: "AnnaRakshak (iPDS)"
                });
            } else {
                navigate('/login');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert("New passwords do not match!");
            return;
        }

        const user = auth.currentUser;
        if (!user || !user.email) {
            alert("No authenticated user found.");
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            alert("Password updated successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error("Error updating password:", error);
            alert("Failed to update password. Please check your current password.");
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const getInitial = (name) => {
        return name && name !== "Loading..." ? name.charAt(0).toUpperCase() : "A";
    };

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px" }}>
            <Nav />

            <main className="container">


                <section className="form-card profile-section">
                    <h2 className="section-title">Profile Information</h2>

                    <div className="profile-top">
                        <div className="avatar">{getInitial(userData.name)}</div>
                        <div>
                            <h3 style={{ margin: 0, color: "#fff", fontSize: "20px" }}>{userData.name}</h3>
                            <p style={{ color: "#8294aa", fontSize: "14px", margin: "4px 0" }}>{userData.email}</p>
                            <span className="role-badge">{userData.role}</span>
                        </div>
                    </div>

                    <div className="details-grid">
                        <div className="detail-box">
                            <label>Full Name</label>
                            <p>{userData.name}</p>
                        </div>
                        <div className="detail-box">
                            <label>Email Address</label>
                            <p>{userData.email}</p>
                        </div>
                        <div className="detail-box">
                            <label>Assigned Role</label>
                            <p>{userData.role}</p>
                        </div>
                        <div className="detail-box">
                            <label>System Module</label>
                            <p>{userData.system}</p>
                        </div>
                    </div>
                </section>

                <section className="form-card profile-section" style={{ marginTop: "25px" }}>
                    <h2 className="section-title">Change Password</h2>

                    <form onSubmit={handlePasswordUpdate}>
                        <div className="form-group field">
                            <label htmlFor="currentPassword">Current Password *</label>
                            <input
                                type="password"
                                id="currentPassword"
                                className="input"
                                placeholder="Enter current password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group field" style={{ marginTop: "15px" }}>
                            <label htmlFor="newPassword">New Password *</label>
                            <input
                                type="password"
                                id="newPassword"
                                className="input"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group field" style={{ marginTop: "15px" }}>
                            <label htmlFor="confirmPassword">Confirm New Password *</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                className="input"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="buttons" style={{ marginTop: "20px" }}>
                            <button type="submit" className="save-btn">
                                Update Password
                            </button>
                        </div>
                    </form>
                </section>

                <section className="form-card profile-section logout-card" style={{ marginTop: "25px", borderLeft: "5px solid #d32f2f" }}>
                    <h2 className="section-title" style={{ color: "#ef5350" }}>Session Management</h2>

                    <button onClick={handleLogout} className="save-btn" style={{ background: "#c62828" }}>
                        Logout System
                    </button>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default Profile;