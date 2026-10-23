import React, { useEffect, useState } from 'react';
import './App.css';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ResponsiveContainer, PieChart, Cell , Pie ,Legend ,  Tooltip} from 'recharts';

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


const pieData = [
  { name: '0 - 30 days', value: 6, percentage: '33%', color: '#22C55E' },
  { name: '31 - 60 days', value: 5, percentage: '28%', color: '#2563EB' },
  { name: '61 - 90 days', value: 4, percentage: '22%', color: '#F59E0B' },
  { name: '> 90 days', value: 3, percentage: '17%', color: '#EF4444' },
];


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

<div id="piechart">
  <div className="pie-chart-container">
    
    <h1 id='totalbatchesno' >Total Bdsdsatches in stock : 18</h1>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={4}
          stroke="none"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>

        <Tooltip
          contentStyle={{
            backgroundColor: "#120e0e",
            border: "1px solid #000000",
            borderRadius: "10px",
            color: "#f1f5f9",
            padding: "10px 14px",
            width:250,
            height:50,
            fontSize:20
          }}
          itemStyle={{ color: "#f1f5f9" }}
          formatter={(value, name) => [`${value} batches`, name]}
        />

        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            fontSize: "12px",
            color: "#c3cede",
            paddingTop: "10px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>

<div>

</div>

            

            <Footer />
        </div>
    );
}

export default Dashboard;