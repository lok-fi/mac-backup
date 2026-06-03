import styles from "./Footer.module.css";

const Footer = () => {
  return (
    <>
 
    <footer className={styles.appFooter}>
      <div className={styles.footerCenter}>
        © {new Date().getFullYear()} Skyi Partner Portal. All rights reserved.
      </div>
      {/* <div className={styles.footerContainer}> */}
        
       
    </footer>
    </>
  );
};

export default Footer;