import react from "react";
import Nav from './navbar';
import Footer from "./footer";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function LoginPage(){

    const [email, setEmail] = react.useState("");
    const [password, setPassword] = react.useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        
        try{
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login successful");
        }
        catch(error){
            alert("Error logging in:", error);
        }
    }


    return (
        <div class="loginpage" >
            <Nav></Nav>
            <div class="loginform" >
                <h1>Login</h1>
                <form onSubmit={handleLogin}>
                    <input class="inputbox" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} ></input><br></br>
                    <input class="inputbox" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} ></input><br></br>
                    <button class="normalbtn" type="submit" >Login</button>
                </form>

            </div>
            <Footer></Footer>
        </div>
    )
}

export default LoginPage;