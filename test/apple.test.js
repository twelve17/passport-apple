/* global describe, it, before */

const chai = require('chai');
const chaiPassport = require('chai-passport-strategy');
const OAuth2 = require('oauth').OAuth2;
const jwt = require('jsonwebtoken');

const AppleStrategy = require('../lib/strategy');

chai.use(chaiPassport);
const expect = chai.expect;

describe('AppleStrategy', () => {
    describe('constructed', () => {
        describe('with normal options', () => {
            const strategy = new AppleStrategy(
                {
                    clientID: 'CLIENT_ID',
                    teamID: 'TEAM_ID',
                    keyID: 'KEY_ID',
                    key: 'KEY'
                },
                () => {}
            );

            it('should be named apple', () => {
                expect(strategy.name).to.equal('apple');
            });
        });

        describe('without a verify callback', function() {
            it('should throw', function() {
                expect(() => {
                    new AppleStrategy({
                        clientID: 'CLIENT_ID',
                        teamID: 'TEAM_ID',
                        keyID: 'KEY_ID',
                        key: 'KEY'
                    });
                }).to.throw(TypeError, 'AppleStrategy requires a verify callback');
            });
        });

        describe('without a clientID option', function() {
            it('should throw', function() {
                expect(() => {
                    new AppleStrategy(
                        {
                            teamID: 'TEAM_ID',
                            keyID: 'KEY_ID',
                            key: 'KEY'
                        },
                        () => {}
                    );
                }).to.throw(TypeError, 'AppleStrategy requires a clientID option');
            });
        });

        describe('without a teamID option', function() {
            it('should throw', function() {
                expect(() => {
                    new AppleStrategy(
                        {
                            clientID: 'CLIENT_ID',
                            keyID: 'KEY_ID',
                            key: 'KEY'
                        },
                        () => {}
                    );
                }).to.throw(TypeError, 'AppleStrategy requires a teamID option');
            });
        });

        describe('without a keyID option', function() {
            it('should throw', function() {
                expect(() => {
                    new AppleStrategy(
                        {
                            clientID: 'CLIENT_ID',
                            teamID: 'TEAM_ID',
                            key: 'KEY'
                        },
                        () => {}
                    );
                }).to.throw(TypeError, 'AppleStrategy requires a keyID option');
            });
        });

        describe('without a key option', function() {
            it('should throw', function() {
                expect(() => {
                    new AppleStrategy(
                        {
                            clientID: 'CLIENT_ID',
                            teamID: 'TEAM_ID',
                            keyID: 'KEY_ID'
                        },
                        () => {}
                    );
                }).to.throw(TypeError, 'AppleStrategy requires a key option');
            });
        });
    });

    describe('authorization request with display parameter', function() {
        const strategy = new AppleStrategy(
            {
                clientID: 'CLIENT_ID',
                teamID: 'TEAM_ID',
                keyID: 'KEY_ID',
                key: 'KEY'
            },
            () => {}
        );

        let url;

        before(function(done) {
            chai.passport
                .use(strategy)
                .redirect(function(u) {
                    url = u;
                    done();
                })
                .req(() => {})
                .authenticate();
        });

        it('should be redirected', function() {
            expect(url).to.equal(
                'https://appleid.apple.com/auth/authorize?client_id=CLIENT_ID&response_type=code&response_mode=form_post'
            );
        });
    });

    describe('authorization request with state parameter', function() {
        const strategy = new AppleStrategy(
            {
                clientID: 'CLIENT_ID',
                teamID: 'TEAM_ID',
                keyID: 'KEY_ID',
                key: 'KEY'
            },
            () => {}
        );

        let url;

        before(function(done) {
            chai.passport
                .use(strategy)
                .redirect(function(u) {
                    url = u;
                    done();
                })
                .req(function(req) {
                    req.query = { state: 'test-state' };
                })
                .authenticate();
        });

        it('should be redirected', function() {
            expect(url).to.equal(
                'https://appleid.apple.com/auth/authorize?client_id=CLIENT_ID&response_type=code&response_mode=form_post&state=test-state'
            );
        });
    });

    describe('failure caused by user denying request', function() {
        const strategy = new AppleStrategy(
            {
                clientID: 'CLIENT_ID',
                teamID: 'TEAM_ID',
                keyID: 'KEY_ID',
                key: 'KEY'
            },
            () => {}
        );

        let info;

        before(function(done) {
            chai.passport
                .use(strategy)
                .fail(i => {
                    info = i;
                    done();
                })
                .req(function(req) {
                    req.body = {};
                    req.body.error = 'user_cancelled_authorize';
                })
                .authenticate();
        });

        it('should fail with info', function() {
            expect(info).to.not.be.undefined;
            expect(info.message).to.equal('User cancelled authorize');
        });
    });

    describe('authorization response with user data', () => {
        const strategy = new AppleStrategy(
            {
                clientID: 'CLIENT_ID',
                teamID: 'TEAM_ID',
                keyID: 'KEY_ID',
                key: 'KEY'
            },
            (accessToken, refreshToken, profile, done) => done(null, profile)
        );

        strategy._getOAuth2Client = () => {
            const oauth2 = new OAuth2();
            oauth2.getOAuthAccessToken = (code, options, callback) => {
                if (code === 'SplxlOBeZQQYbYS6WxSbIA+ALT1' && options.grant_type === 'authorization_code') {
                    return callback(null, 'AT', 'RT', {
                        id_token: jwt.sign(
                            {
                                email: 'user@example.com'
                            },
                            'secret',
                            {
                                audience: 'CLIENT_ID',
                                issuer: 'https://appleid.apple.com',
                                subject: 'SUBJECT',
                                expiresIn: 3600
                            }
                        )
                    });
                }
                return callback({
                    statusCode: 400,
                    data: '{"error":"invalid_grant"}'
                });
            };
            return oauth2;
        };

        describe('with req.body as object', () => {
            let user;

            before(function(done) {
                chai.passport
                    .use(strategy)
                    .success(u => {
                        user = u;
                        done();
                    })
                    .req(function(req) {
                        req.body = {};
                        req.body.user = {
                            name: { firstName: 'John', lastName: 'Appleseed' }
                        };
                        req.body.code = 'SplxlOBeZQQYbYS6WxSbIA+ALT1';
                    })
                    .authenticate();
            });

            it('should retrieve the user', function() {
                expect(user.id).to.equal('SUBJECT');
                expect(user.email).to.equal('user@example.com');
                expect(user.name.firstName).to.equal('John');
                expect(user.name.lastName).to.equal('Appleseed');
            });
        });

        describe('with req.body as string', () => {
            let user;

            before(function(done) {
                chai.passport
                    .use(strategy)
                    .success(u => {
                        user = u;
                        done();
                    })
                    .req(function(req) {
                        req.body = {};
                        req.body.user = JSON.stringify({
                            name: { firstName: 'John', lastName: 'Appleseed' }
                        });
                        req.body.code = 'SplxlOBeZQQYbYS6WxSbIA+ALT1';
                    })
                    .authenticate();
            });

            it('should retrieve the user', function() {
                expect(user.id).to.equal('SUBJECT');
                expect(user.email).to.equal('user@example.com');
                expect(user.name.firstName).to.equal('John');
                expect(user.name.lastName).to.equal('Appleseed');
            });
        });
    });

    describe('error caused by invalid code sent to token endpoint', function() {
        const strategy = new AppleStrategy(
            {
                clientID: 'CLIENT_ID',
                teamID: 'TEAM_ID',
                keyID: 'KEY_ID',
                key: 'KEY'
            },
            () => {}
        );

        strategy._getOAuth2Client = () => {
            const oauth2 = new OAuth2();
            oauth2.getOAuthAccessToken = (code, options, callback) => {
                return callback({
                    statusCode: 400,
                    data: '{"error":"invalid_grant"}'
                });
            };
            return oauth2;
        };

        let err;

        before(function(done) {
            chai.passport
                .use(strategy)
                .error(function(e) {
                    err = e;
                    done();
                })
                .req(function(req) {
                    req.body = {};
                    req.body.code = 'SplxlOBeZQQYbYS6WxSbIA+ALT1';
                })
                .authenticate();
        });

        it('should error', function() {
            expect(err.constructor.name).to.equal('TokenError');
            expect(err.code).to.equal('invalid_grant');
        });
    });
});
