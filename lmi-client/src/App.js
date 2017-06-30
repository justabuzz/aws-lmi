import React, { Component } from 'react';
import './App.css';
import axios from 'axios';

import { signin, signout, getIdJwtToken } from './utils/CognitoHelper.js';

class App extends Component {

  constructor(props, context) {
    super(props, context)

    this.state = {
      loading: false,
      error: false,
      username: '',
      password: '',
      ip: '',
      fromPort: 22,
      toPort: undefined,
      minutesToLive: 5,
      authenticated: false,
      success: false,
    }
  }

  componentWillMount() {
    this.populateIpField();
  }

  login() {
    let data = {
      username: this.state.username,
      password: this.state.password
    };

    this.setState({ loading: true });
    this.setState({ error: false });

    signin(data.username, data.password)
      .then(function (result) {
        this.setState({ authenticated: true });
        this.setState({ loading: false });
      }.bind(this))
      .catch(function (error) {
        console.log(error);
        this.setState({ error: true });
        this.setState({ loading: false });
      }.bind(this));
  }

  logout() {
    signout();
    this.setState({ authenticated: false });
  }

  lmi() {
    let data = {
      minutesToLive: this.state.minutesToLive,
      ip: this.state.ip,
      ports: [
        {
          from: this.state.fromPort,
          to: this.state.toPort !== undefined ? this.state.toPort : this.state.fromPort,
        }
      ]
    };

    this.setState({ loading: true });
    this.setState({ success: false });
    this.setState({ error: false });

    console.log(data);
    console.log(getIdJwtToken());

    axios.post('https://jdyk7lk4ag.execute-api.ap-southeast-2.amazonaws.com/dev/lmi', data, {
      headers: {
				Authorization: getIdJwtToken()
			}})
      .then(function (response) {
        console.log(response);
        this.setState({ loading: false });
        this.setState({ success: true });
      }.bind(this))
      .catch(function (error) {
        console.log(error);
        this.setState({ error: true });
        this.setState({ loading: false });
      }.bind(this));
  }

  populateIpField() {
    axios.get('//freegeoip.net/json/')
      .then(function (response) {
        console.log(response);
        this.setState({ ip: response.data.ip });
      }.bind(this))
      .catch(function (error) {
        console.log(error);
      });
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>Let Me In (to my AWS)</h2>
        </div>

        <div id="login" className={this.state.authenticated ? 'hide' : ''}>
          <form onSubmit={(e) => { e.preventDefault(); this.login(e) }}>
            <div><label>Username:</label> <input type="textbox" onChange={(e) => this.setState({ username: e.target.value })} /></div>
            <div><label>Password:</label> <input type="password" onChange={(e) => this.setState({ password: e.target.value })} /></div>
            <input type="submit" />
          </form>
        </div>

        <div id="lmi" className={this.state.authenticated ? '' : 'hide'}>
          <form onSubmit={(e) => { e.preventDefault(); this.lmi(e) }}>
            <div><label>IP:</label> <input type="textbox" onChange={(e) => this.setState({ ip: e.target.value })} value={ this.state.ip } /></div>
            <div>
              <label>Ports:</label>
              <div className="ports-holder">
                <input type="number" className="port" onChange={(e) => this.setState({ fromPort: parseInt(e.target.value, 10) })} value={ this.state.fromPort } />
                <span className="portTo">to</span>
                <input type="number" className="port" onChange={(e) => this.setState({ toPort: parseInt(e.target.value, 10) })} value={ this.state.toPort } />
              </div>
            </div>
            <div><label>Minutes To Live:</label> <input type="number" className="mins-to-live" onChange={(e) => this.setState({ minutesToLive: parseInt(e.target.value, 10) })} value={ this.state.minutesToLive } /></div>
            <input type="submit" />
          </form>
          <button onClick={(e) => this.logout()}>Log out</button>
        </div>

        {this.state.loading && <div>Loading...</div>}
        {this.state.error && <div className="error">Error occured</div>}
        {this.state.success && <div className="success">Success!</div>}

        <div className="footer">
          Developed by David Treves<br/>
          <a href="https://www.onclouds.com.au/" target="_blank">https://www.onclouds.com.au/</a>
        </div>
      </div>
    );
  }
}

export default App;
