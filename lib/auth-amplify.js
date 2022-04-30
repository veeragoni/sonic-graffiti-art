import Amplify, { Auth } from 'aws-amplify';
import awsconfig from '../amplify/src/aws-exports';
Amplify.configure(awsconfig);

// $('#login-button').click( function () {
//     try {
//         let username = $('#email_id').val();
//         let password = $('#password').val()
//         const user =  Auth.signIn(username, password);
//         console.log(user);
//         console.log(Auth.currentCredentials());
//         console.log(Auth.currentUserCredentials());
//     } catch (error) {
//         console.log('error signing in', error);
//     }
// });

$('#signup-button').click( function () {
    try {
        
        let email = $('#email_id').val();
        let username = $('#email_id').val();
        let password = $('#password').val()
        console.log("email", email);
        const { user } =  Auth.signUp({
            username,
            password,
            attributes: {
                email
            }
        }).then(function(value){
            $('#verificationDiv').show();
            $('#signUpDiv').hide();
        }, function(error) {
            console.log("SignUp error:", error);
        });
        console.log(user);
    } catch (error) {
        console.log('error signing up:', error);
    }
});

$('#confirm-signup-button').click( function () {
    try {
        let username = $('#verification_email_id').val();
        let code = $('#verification_code').val();
        Auth.confirmSignUp(username, code).then(function(value){
            $('#signUpstatus').text("SucessFully verified");
        }, function(error){
            console.log("Error while confirming sign up:", error);
            $('#signUpstatus').text("Verification was unsucessful");
        });
    } catch (error) {
        console.log('error confirming sign up', error);
    }
});

