import react from "react";
import LoginPage from "./login";
import {Link} from "react-router-dom";
import {useState , useEffect} from "react";
import {getAuth , onAuthStateChanged} from "firebase/auth";
import {signOut} from "firebase/auth";
import {auth} from "./firebase";
import {doc , getDoc} from "firebase/firestore";
import {db} from "./firebase";

function Nav(props){

    const [user, setUser] = useState(null);
    const [userName, setUserName] = useState("");
    const [role, setRole] = useState("");

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

    const signout = async () => {
        try{
            await signOut(auth);
            alert("Logout successful");
        } catch (error) {
            console.error(error);
        }
    };


    return(
        <div class="CommonNav" >
            {/* {user?(<button style={{background:"red",position:"absolute",left:10,top:10}} class="normalbtn" onClick={signout} >Logout</button>):(<Link to="/login" ><button style={{position:"absolute",left:10,top:10}} class="normalbtn">Login</button></Link>)} */}

            {user?(<div id='welcomebox' ><h1>{user.displayName}</h1> <br></br> <p>{role}</p> </div>):("")}
            <ul>
                <Link to="/"><li>Dashboard</li></Link>
                <Link to="/about"><li>Manage Inventory</li></Link>
                <Link to="/about"><li>Add Stock</li></Link>
                <Link to="/contact"><li>Dispatch</li></Link>
                {user?(<Link to="/profile"><li>Profile</li></Link>):("")}
            </ul>
        </div>
    )
}

export default Nav;