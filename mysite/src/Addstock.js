import react from 'react';
import Nav from './navbar';
import Footer from './footer';

function Addstock(){
    return(
  
  <div>
    <Nav></Nav>




  <main class="container">

    <div class="heading">
      <h1>Add New Stock</h1>

    </div>

    <form class="form-card">

      <h2 class="section-title">Stock Information</h2>

      <div class="form-grid">

        <div class="field">
          <label for="commodity">Commodity Name *</label>
          <select id="commodity" required>
            <option value="">Select commodity</option>
            <option>Wheat</option>
            <option>Rice</option>
            <option>Sugar</option>
            <option>Salt</option>
            <option>Oil</option>
            <option>Chana</option>
            <option>Tuvar Dal</option>
          </select>
        </div>

        <div class="field">
          <label for="batch">Batch Number *</label>
          <input
            type="text"
            id="batch"
            placeholder="e.g. WHT-2026-001"
            required
          ></input>
        </div>

        <div class="field">
          <label for="quantity">Quantity Received *</label>
          <input
            type="number"
            id="quantity"
            min="0.01"
            step="0.01"
            placeholder="Enter quantity"
            required
          ></input>
        </div>

        <div class="field">
          <label for="unit">Unit *</label>
          <select id="unit" required>
            <option value="">Select unit</option>
            <option value="kg">Kilogram (kg)</option>
            <option value="quintal">Quintal</option>
            <option value="ton">Metric Ton</option>
            <option value="litre">Litre</option>
          </select>
        </div>

        <div class="field">
          <label for="godown">Godown Location *</label>
          <input
            type="text"
            id="godown"
            placeholder="Enter godown name"
            required
          ></input>
        </div>

        <div class="field">
          <label for="supplier">Supplier / Source *</label>
          <input
            type="text"
            id="supplier"
            placeholder="Enter supplier name"
            required
          ></input>
        </div>

        <div class="field">
          <label for="received">Receiving Date *</label>
          <input type="date" id="received" required></input>
        </div>

        <div class="field">
          <label for="expiry">Expiry / Best Before Date</label>
          <input type="date" id="expiry"></input>
        </div>

        <div class="field full-width">
          <label for="quality">Quality Status *</label>
          <select id="quality" required>
            <option value="">Select quality status</option>
            <option value="eligible">
              Quality Checked - Eligible
            </option>
            <option value="pending">
              Quality Check Pending
            </option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

      </div>


      <div class="buttons">
        <button type="reset" class="clear-btn">
          Clear Form
        </button>

        <button type="submit" class="save-btn">
          Save Stock
        </button>
      </div>

    </form>

  </main>

        

        <Footer></Footer>
        
        </div>
    )
}


export default Addstock;