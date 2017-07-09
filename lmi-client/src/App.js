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
      autoUpdateIpCbChecked: false,
      autoUpdateIntervalId: undefined,
      processingUpdate: false,
      currentRules: [],
      ruleListRefreshIntervalId: undefined,
    }
  }

  componentWillMount() {
    this.populateIpField()
      .then(function(){});
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
        this.refreshCurrentRuleList();
        this.startAutoRefreshRuleList();
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
    this.stopAutoRefreshRuleList();
    this.stopAutoUpdateIp();
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

    this.setState({ loading: true, success: false, error: false });

    //console.log(data);
    //console.log(getIdJwtToken());

    axios.post(window.APIG_ENDPOINT + '/lmi', data, {
      headers: {
				Authorization: getIdJwtToken()
			}})
    .then(function (response) {
      console.log(response);
      this.setState({ loading: false, success: true });
      this.refreshCurrentRuleList();
    }.bind(this))
    .catch(function (error) {
      console.log(error);
      this.setState({ error: true, loading: false });
    }.bind(this));
  }

  refreshCurrentRuleList() {
    this.setState({ error: false, loading: true, success: false });

    axios.get(window.APIG_ENDPOINT + '/lmi', {
      headers: {
				Authorization: getIdJwtToken()
			}})
    .then(function (response) {
      let body = JSON.parse(response.data.body);
      this.setState({ error: false, loading: false, currentRules: body.result });

      if (body.result.length === 0) {
        this.stopAutoRefreshRuleList();
        this.stopAutoUpdateIp();
      } else {
        this.startAutoRefreshRuleList();
        this.startAutoUpdateIp();
      }
    }.bind(this))
    .catch(function (error) {
      console.log(error);
      this.setState({ error: true, loading: false });
    }.bind(this));
  }

  deleteRule(ruleId) {
    this.setState({ error: false, loading: true, success: false });

    axios.delete(window.APIG_ENDPOINT + '/lmi', {
      params: {
        ruleId: ruleId
      },
      headers: {
				Authorization: getIdJwtToken()
			}})
    .then(function (response) {
      let body = JSON.parse(response.data.body);
      this.refreshCurrentRuleList();
      this.setState({ error: false, loading: false });
    }.bind(this))
    .catch(function (error) {
      console.log(error);
      this.setState({ error: true, loading: false });
    }.bind(this));
  }

  updateIp() {
    if (this.state.processingUpdate)
      return;

    this.setState({ processingUpdate: true }, function() {
      let currentIp = this.state.ip;

      this.populateIpField()
      .then(function() {
        if (this.state.ip === currentIp) {
          this.setState({ processingUpdate: false });
          return;
        }

        let data = {
          newIp: this.state.ip
        };

        this.setState({ loading: true, success: false, error: false });

        axios.post(window.APIG_ENDPOINT + '/updateIp', data, {
          headers: {
            Authorization: getIdJwtToken()
          }})
        .then(function (response) {
          this.setState({ loading: false, success: true, processingUpdate: false });
          this.refreshCurrentRuleList();
        }.bind(this))
        .catch(function (error) {
          console.log(error);
          this.setState({ error: true, loading: false, processingUpdate: false });
        }.bind(this));

      }.bind(this));
    });
  }

  toggleAutoUpdateIp(cb) {
    this.setState({ autoUpdateIpCbChecked: cb.target.checked }, function() {
      if (this.state.autoUpdateIpCbChecked) {
        this.startAutoUpdateIp();
      } else {
        this.stopAutoUpdateIp();
      }
    }.bind(this))
  }

  startAutoUpdateIp() {
    if (this.state.autoUpdateIpCbChecked && this.state.autoUpdateIntervalId === undefined) {
      let intervalId = window.setInterval(this.updateIp.bind(this), 2000);
      this.setState({ autoUpdateIntervalId: intervalId });
    }
  }

  stopAutoUpdateIp() {
    if (this.state.autoUpdateIntervalId !== undefined) {
      window.clearInterval(this.state.autoUpdateIntervalId);
      this.setState({autoUpdateIntervalId: undefined});
    }
  }

  startAutoRefreshRuleList() {
    if (this.state.ruleListRefreshIntervalId === undefined) {
      let intervalId = window.setInterval(this.refreshCurrentRuleList.bind(this), 60000);
      this.setState({ ruleListRefreshIntervalId: intervalId });
    }
  }

  stopAutoRefreshRuleList() {
    if (this.state.ruleListRefreshIntervalId !== undefined) {
      window.clearInterval(this.state.ruleListRefreshIntervalId);
      this.setState({ruleListRefreshIntervalId: undefined});
    }
  }

  populateIpField() {
    return this.whatIsMyIp()
    .then(function(ip) {
      this.setState({ ip: ip });
    }.bind(this))
    .catch(function (error) {
      console.log(error);
    });
  }

  whatIsMyIp() {
    return axios.get('//freegeoip.net/json/')
      .then(function (response) {
        return response.data.ip;
      });
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>Let Me In (to my EC2s)</h2>
        </div>

        <div className={ 'box logout' + (this.state.authenticated ? '' : ' hide') }>
          <button onClick={(e) => this.logout()}>Sign Out</button>
        </div>

        <div id="login" className={ 'box' + (this.state.authenticated ? ' hide' : '') }>
          <h3>Sign In</h3>
          <form onSubmit={(e) => { e.preventDefault(); this.login(e) }}>
            <div><label>Username:</label> <input type="textbox" onChange={(e) => this.setState({ username: e.target.value })} /></div>
            <div><label>Password:</label> <input type="password" onChange={(e) => this.setState({ password: e.target.value })} /></div>
            <input type="submit" value="Sign In" />
          </form>
        </div>

        <div id="lmi" className={ 'box' + (this.state.authenticated ? '' : ' hide') }>
          <h3>Add SG Rule</h3>
          <form onSubmit={(e) => { e.preventDefault(); this.lmi(e) }}>
            <div>
              <label>IP:</label>
              <input type="textbox" onChange={(e) => this.setState({ ip: e.target.value })}
                value={ this.state.ip } disabled={ this.state.autoUpdateIpCbChecked } />
            </div>
            <div>
              <label>Ports:</label>
              <div className="ports-holder">
                <input type="number" className="port" onChange={(e) => this.setState({ fromPort: parseInt(e.target.value, 10) })}
                  value={ this.state.fromPort } disabled={ this.state.autoUpdateIpCbChecked } />
                <span className="portTo">to</span>
                <input type="number" className="port" onChange={(e) => this.setState({ toPort: parseInt(e.target.value, 10) })}
                  value={ this.state.toPort } disabled={ this.state.autoUpdateIpCbChecked } />
              </div>
            </div>
            <div>
              <label>Minutes To Live:</label>
              <input type="number" className="mins-to-live" onChange={(e) => this.setState({ minutesToLive: parseInt(e.target.value, 10) })}
                value={ this.state.minutesToLive } disabled={ this.state.autoUpdateIpCbChecked } />
            </div>
            <input type="submit" value="Add Rule" disabled={ this.state.autoUpdateIpCbChecked } />
          </form>
        </div>

        <div className={ 'box rule-list' + (this.state.authenticated ? '' : ' hide') }>
          <h3>Current Rules</h3>
          <table>
            <thead>
              <tr>
                <th>IP</th>
                <th>Ports</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.currentRules.map(function(r, i) {
                  return <tr key={ i }>
                    <td>{ r.rule.ip }</td>
                    <td>{ r.rule.ports.map(function(p, j) { return <span key={ j } className="ports">{ p.from + (p.from != p.to ? '-' + p.to : '') }</span> }) }</td>
                    <td>{ (new Date(r.expiry * 1000).toLocaleString()) }</td>
                    <td><span className="btn-delete" onClick={ (e) => { this.deleteRule(r.id); }}>Delete</span></td>
                  </tr>
                }, this)
              }
              {
                this.state.currentRules.length === 0 && <tr><td colSpan="4">No current rules</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div className={ 'box auto-update' + (this.state.authenticated ? '' : ' hide') }>
          <h3>Auto Update IP</h3>
          <label>
            <input type="checkbox" onClick={ (e) => { this.toggleAutoUpdateIp(e); } } />Activate
          </label>
          <p>
            If your IP address changes frequently then you can activate Auto Update, which will automatically detect IP changes and
            will update current SG rules accordingly. Add the rules you need first and then activate Auto Update. You cannot add rules
            while Auto Update is active.
          </p>
        </div>

        {this.state.loading && <div>Loading...</div>}
        {this.state.error && <div className="error">Error occured</div>}
        {this.state.success && <div className="success">Success!</div>}

        <div className="footer">
          Developed by David Treves<br/>
          <a href="https://www.onclouds.com.au/" target="_blank" rel="noopener noreferrer">https://www.onclouds.com.au/</a>
        </div>
      </div>
    );
  }
}

export default App;
