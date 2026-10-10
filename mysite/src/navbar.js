import react from "react";
import LoginPage from "./login";
import {Link} from "react-router-dom";
import {useState , useEffect} from "react";
import {getAuth , onAuthStateChanged} from "firebase/auth";
import {signOut} from "firebase/auth";
import {auth} from "./firebase";

function Nav(props){

    const [user, setUser] = useState(null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setUser(user);
          } else {
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
            {user?(<button style={{background:"red",position:"absolute",left:10,top:10}} class="normalbtn" onClick={signout} >Logout</button>):(<Link to="/login" ><button style={{position:"absolute",left:10,top:10}} class="normalbtn">Login</button></Link>)}
            <ul>
                <Link to="/"><li>Home</li></Link>
                <Link to="/about"><li>About</li></Link>
                <Link to="/contact"><li>Contact</li></Link>
            </ul>
        </div>
    )
}

export default Nav;