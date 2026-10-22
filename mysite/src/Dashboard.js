import React, { useEffect, useState } from 'react';
import './App.css';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

function Dashboard() {
    const [userName, setUserName] = useState("");
    const [role, setRole] = useState("");
    const [user, setUser] = useState(null);

    const signout = async () => {
        try {
            await signOut(auth);
            alert("Logout successful");
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserName(currentUser.displayName);

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
        <div style={{ textAlign: "left" }} >
            <Nav />

            <div onClick={() => {
                document.getElementById('class-form').style.display = 'none';
                document.getElementById('blackfilter').style.display = 'none';
            }} id="blackfilter" ></div>

            {/* <button onClick={() => {
                document.getElementById('class-form').style.display = 'block';
                document.getElementById('blackfilter').style.display = 'block';
            }} className='normalbtn' style={{ background: "gray", width: 150, margin: 30, marginTop: 40 }} >+ Create class</button> */}
{/* 
            <p id="wlcmtxt" > Welcome , {userName}</p>
            <p>{role}</p> */}

            <div id="class-form" >
                <form>
                    <h1 style={{ fontSize: 30 }} >Class details</h1>

                    <input placeholder='Topic(s) to be discussed' className='inputbox' type='text' id='topic' name='topic' ></input>
                    <br></br>
                    <input placeholder='Venue of discussion 📍 ' className='inputbox' type='text' id='venue' name='venue' ></input>
                    <br></br>
                    <input style={{ width: "30%" }} placeholder='Date of discussion 📅 ' className='inputbox' type='date' id='date' name='date' ></input>
                    <input style={{ width: "25%", marginLeft: 10 }} placeholder='Time of discussion ⏰ ' className='inputbox' type='time' id='time' name='time' ></input>
                    <br></br>
                    <textarea placeholder='Details about the class' style={{ height: "20vh", marginTop: 20, padding: 20 }} className='inputbox' >
                    </textarea>

                    <br></br>

                    <button className='normalbtn' >Create</button>

                </form>
            </div>

            <div id="class-list" ></div>

            <Footer />
        </div>
    );
}

export default Dashboard;