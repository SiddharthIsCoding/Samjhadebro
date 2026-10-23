import './App.css';
import Normalbutton from "./Normalbtn";
import Nav from './navbar';
import Footer from "./footer";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import LoginPage from './login';
import Signup from './signup';
import NotFound from './404';
import { useEffect, useState } from "react";
import Dashboard from './Dashboard';
import Test from './Test';
import { auth, db } from './firebase';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import Addstock from './Addstock';
import Dispatch from './dispatch';
import Profile from './profile';
import Inventory from './inventory';
import Logs from './logs';
import BatchView from './BatchView';
import Status from './status';

function Home() {
    return (
        <div className="main">
            <Nav />
            <br />
            <h1><span style={{color:"rgb(174, 128, 43)"}} >अन्न</span>Rakshak</h1>
            <p>TRANSPARENCY . TRACEABILITY . ACCOUNTABILITY </p>
            <Link to="/login">
                <button className='normalbtn'>Login</button>
            </Link>
            <Link to="/status">
                <button className='normalbtn'>Check Status</button>
            </Link>
            <Footer />
        </div>
    );
}

// Protected Route Component handling Auth & Role Authorization
const ProtectedRoute = ({ user, role, allowedRoles, loading, children }) => {
    if (loading) {
        return (
            <div style={{ textAlign: "center", color: "white", padding: "100px", background: "#1b1616", minHeight: "100vh" }}>
                <h2>Loading user session...</h2>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Normalize role string comparison
    const normalizedRole = (role || "").toLowerCase().trim();
    const isAllowed = allowedRoles.some(r => normalizedRole.includes(r.toLowerCase()));

    if (!isAllowed) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

function App() {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState("");
    const [userName, setUserName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserName(currentUser.displayName || "User");

                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(userDocRef);

                    if (docSnap.exists()) {
                        setRole(docSnap.data().role || "warehouse_manager");
                    } else {
                        setRole("warehouse_manager");
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setRole("warehouse_manager");
                }
            } else {
                setUserName("");
                setRole("");
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const ALL_ROLES = ["admin", "warehouse", "manager", "inspection", "officer"];
    const MANAGERS_AND_ADMIN = ["admin", "warehouse", "manager"];

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Home Route */}
                <Route 
                    path="/" 
                    element={user ? <Navigate to="/dashboard" replace /> : <Home />} 
                />

                {/* Login & Signup */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<Signup />} />

                {/* Role-Protected Routes */}
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute user={user} role={role} allowedRoles={ALL_ROLES} loading={loading}>
                            <Dashboard />
                        </ProtectedRoute>
                    } 
                />

                <Route 
                    path="/inventory" 
                    element={
                        <ProtectedRoute user={user} role={role} allowedRoles={ALL_ROLES} loading={loading}>
                            <Inventory />
                        </ProtectedRoute>
                    } 
                />

                <Route 
                    path="/addstock" 
                    element={
                        <ProtectedRoute user={user} role={role} allowedRoles={MANAGERS_AND_ADMIN} loading={loading}>
                            <Addstock />
                        </ProtectedRoute>
                    } 
                />

                <Route 
                    path="/dispatch" 
                    element={
                        <ProtectedRoute user={user} role={role} allowedRoles={MANAGERS_AND_ADMIN} loading={loading}>
                            <Dispatch />
                        </ProtectedRoute>
                    } 
                />

                <Route 
                    path="/profile" 
                    element={
                        <ProtectedRoute user={user} role={role} allowedRoles={ALL_ROLES} loading={loading}>
                            <Profile />
                        </ProtectedRoute>
                    } 
                />

                <Route 
                     path="/logs" 
                     element={
                         <ProtectedRoute user={user} role={role} allowedRoles={["admin", "inspection", "officer"]} loading={loading}>
                             <Logs />
                         </ProtectedRoute>
                     } 
                 />

                 <Route path="/batch/:id" element={<BatchView />} />

                 <Route path='/status' element={<Status/>} />

                <Route path="/test" element={<Test />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;